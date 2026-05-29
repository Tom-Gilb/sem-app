// UNIT_TYPE=Lib
// maria/mock.ts — deterministic mock MariaResult
//
// Pure function. No Vue, no Anthropic SDK, no network, no browser APIs.
// Returns a realistic board-document analysis so the full Maria UI flow can be
// demonstrated without a live API connection (VITE_MOCK_MODE=true) and so
// unit tests have a stable fixture to assert against.
//
// Portability: import this anywhere — Node, Deno, Vitest, Playwright, Twin.

import type { MariaResult } from '../../types/maria'

/**
 * Returns a realistic mock MariaResult simulating analysis of a short
 * board-meeting minutes document.
 *
 * Stable across calls (no randomness) — suitable for snapshot tests.
 * The `generatedAt` field uses `new Date().toISOString()` so it reflects
 * the current run time; if you need a fully frozen fixture, override it
 * after calling this function.
 */
export function buildMockMariaResult(): MariaResult {
  return {
    decisionInventory: [
      {
        id: 'D1',
        text: 'The Board approved the 2026 Annual Operating Plan and Budget of $4.2M.',
        layer: 'board',
        layerRationale:
          'Full board budget approval above the delegated management threshold is a board-reserved decision under the constitution. The CFO presented and the board formally resolved.',
        authorityGapFlagged: false,
      },
      {
        id: 'D2',
        text: 'A new Chief Technology Officer was appointed at a total package of $320,000.',
        layer: 'board',
        layerRationale:
          'Senior executive appointment at CTO level is board-reserved in most governance frameworks. However, the record states the CEO "advised" the board rather than the board formally approving — creating an authority record ambiguity.',
        authorityGapFlagged: true,
        authorityGapNote:
          'The CTO appointment was presented as an information item ("the CEO advised") rather than as a board resolution. If CTO-level appointments require board approval under the delegation policy, the distinction between noting and approving creates a gap in the authority record.',
      },
      {
        id: 'D3',
        text: 'Management will finalise and implement the Q2 marketing strategy within the approved budget.',
        layer: 'management',
        layerRationale:
          'Marketing strategy implementation within an approved budget is appropriately delegated to management. The board has set the budget boundary; management decides the approach within it.',
        authorityGapFlagged: false,
      },
      {
        id: 'D4',
        text: 'The Board noted the external audit report and requested a management response by the next meeting.',
        layer: 'board',
        layerRationale:
          'Engaging with the external audit and directing management to respond is an appropriate board-level oversight action. The request for a formal management response at the next meeting creates a clear accountability loop.',
        authorityGapFlagged: false,
      },
    ],

    authorityReport: [
      {
        decisionIds: ['D2'],
        issue:
          'The CTO appointment appears in the minutes as information provided by the CEO rather than as a board resolution. Under most governance frameworks, C-suite appointments require explicit board approval — the distinction between the board "noting" an appointment and the board "approving" it is legally and governance-materially significant.',
        opportunity:
          'The board could strengthen the appointment record by passing a ratification resolution at the next meeting, and by updating the delegation policy to explicitly list which executive roles require board approval — creating a clear, durable framework for all future senior appointments.',
        severity: 'moderate',
      },
    ],

    governanceGaps: [
      {
        id: 'G1',
        category: 'Unresolved compliance matter',
        significance:
          "The GDPR compliance review was mentioned as 'ongoing' but no board direction, timeline, or resolution was recorded. A regulatory compliance matter at this level warrants a formal board disposition — acknowledging without directing leaves the board's oversight role unrecorded in the minutes.",
        opportunity:
          'Adding a GDPR compliance update to the next agenda as a required resolution item — status, any identified risk, and a board-directed action or acceptance — would close this gap and create a defensible record of board oversight for any future regulatory inquiry.',
      },
    ],

    patternAnalysis: [
      {
        id: 'P1',
        type: 'strength',
        label: 'Formal strategic budget governance in place',
        description:
          "The board formally approved the annual budget with CFO presentation — a correct and complete governance practice. The decision is clearly framed as a board resolution with a named amount, appropriate for the board's strategic authority level. This demonstrates that the board understands the distinction between board-reserved and delegated financial decisions.",
        opportunity:
          'The board could further strengthen budget governance by scheduling a mid-year reforecast review point, ensuring board-level visibility into material variances before year-end pressure reduces options.',
        evidenceDecisionIds: ['D1'],
      },
      {
        id: 'P2',
        type: 'concern',
        label: 'Senior appointments recorded as information, not resolutions',
        description:
          'The CTO appointment was presented to the board as a CEO advisory rather than a board resolution. This pattern — where significant management decisions are surfaced to the board as information — blurs the boundary between board authority and management authority, and creates gaps in the formal governance record that could be material in a dispute or regulatory review.',
        opportunity:
          'Introducing a clear appointment authority matrix (which roles require board approval, which are CEO authority) and adopting a simple "board ratification" agenda item for all board-reserved appointments would take minimal meeting time and create a much stronger governance record going forward.',
        evidenceDecisionIds: ['D2'],
      },
      {
        id: 'P3',
        type: 'concern',
        label: 'Compliance matters acknowledged without formal board disposition',
        description:
          "The GDPR compliance matter appears in the minutes as a progress note rather than a resolved item with a board direction. This pattern — acknowledging compliance and regulatory matters without a formal board response — limits the board's ability to demonstrate active oversight if a matter is later investigated by a regulator or raised in litigation.",
        opportunity:
          'Adopting a standing compliance agenda template — flagging status (on track / at risk / breach), required board action, and a named resolution — would take minimal agenda time and significantly strengthen the governance record for all compliance and regulatory matters.',
        evidenceDecisionIds: ['D4'],
      },
      {
        id: 'P4',
        type: 'strength',
        label: 'Appropriate management delegation maintained',
        description:
          "The Q2 marketing strategy was correctly left with management to finalise within the approved budget — the board set the financial boundary and delegated implementation decisions to the appropriate layer. This demonstrates healthy governance hygiene: the board is not reaching down into operational details it has appropriately delegated.",
        opportunity:
          'The board could make this delegation practice more explicit by periodically reviewing the delegation policy to confirm that all delegated authorities have appropriate reporting-back mechanisms, ensuring the board receives the right signals without micromanaging the execution.',
        evidenceDecisionIds: ['D3'],
      },
    ],

    generatedAt: new Date().toISOString(),
    sourceWordCount: 142,
  }
}
