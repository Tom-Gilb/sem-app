// UNIT_TYPE=Lib
// maria/boardMatcher.ts — keyword-match board members to action items
//
// Pure function. No Vue, no Anthropic SDK, no browser APIs.
// Given a text snippet (e.g. a governance-gap significance + opportunity, or an
// authority-report issue + opportunity) and a list of BoardMember profiles,
// returns a ranked list of suggested members with human-readable match reasons.
//
// Scoring weights:
//   specialAbilities match  → +3  (strongest signal: they can do the work)
//   specialInterests match  → +2  (they care about this domain)
//   volunteersFor match     → +2  (they step up for this type of task)
//   dislikesTasks match     → −2  (avoid suggesting them for work they resist)
//
// Only members with a positive net score are returned. Ties are broken by the
// order they appear in boardMembers.ts (earlier = higher priority).
//
// Portability: import anywhere — Node, Deno, browser, Kai-Zen, Twin service.
// The only dependency is src/types/board.ts which is also framework-free.

import type { BoardMember } from '../../types/board'

/** A single suggestion result — one member + score + readable match reasons. */
export interface MemberMatch {
  member: BoardMember
  /** Net relevance score. Higher = better match. Always > 0 in returned results. */
  score: number
  /**
   * Human-readable reasons for the match. Shown as a HoverHint on suggestion chips.
   * Format: 'ability: financial analysis', 'interest: governance', etc.
   */
  reasons: string[]
}

/**
 * Match board members to a text snippet from Maria's analysis output.
 *
 * @param itemText  The text to match against (e.g. gap.significance + gap.opportunity).
 * @param members   The board member roster (from boardMembers.ts).
 * @param topN      Maximum number of suggestions to return (default 2).
 * @returns         Ranked array of MemberMatch, best match first. Empty if no match.
 */
export function matchMembersToItem(
  itemText: string,
  members: BoardMember[],
  topN = 2,
): MemberMatch[] {
  const normalised = itemText.toLowerCase()

  const results: MemberMatch[] = []

  for (const member of members) {
    let score = 0
    const reasons: string[] = []

    // Abilities — highest weight: they have the skill to act on this item
    for (const ability of member.specialAbilities) {
      if (normalised.includes(ability.toLowerCase())) {
        score += 3
        reasons.push(`ability: ${ability}`)
      }
    }

    // Interests — they care about this domain
    for (const interest of member.specialInterests) {
      if (normalised.includes(interest.toLowerCase())) {
        score += 2
        reasons.push(`interest: ${interest}`)
      }
    }

    // Volunteers for — they step up for this type of work
    for (const vol of member.volunteersFor) {
      if (normalised.includes(vol.toLowerCase())) {
        score += 2
        reasons.push(`volunteers for: ${vol}`)
      }
    }

    // Dislikes — negative weight: steer away from tasks they resist
    for (const dislike of member.dislikesTasks) {
      if (normalised.includes(dislike.toLowerCase())) {
        score -= 2
        reasons.push(`⚠ dislikes: ${dislike}`)
      }
    }

    if (score > 0) {
      results.push({ member, score, reasons })
    }
  }

  // Sort descending by score, then slice to topN
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
