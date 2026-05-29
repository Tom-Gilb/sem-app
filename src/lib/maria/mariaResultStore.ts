// UNIT_TYPE=Lib
// maria/mariaResultStore.ts — module-level singleton for the last MariaResult.
//
// Written to by MariaAgentBoard.vue immediately after each successful analysis.
// Read by MariaBoardHub.vue to power the "Import from last analysis" button.
//
// Architecture: module-level ref (not composable-scoped) so all component
// instances share the same pointer regardless of mount/unmount cycles.
//
// Portability: no Vue component types, no browser-specific APIs beyond ref().
// The only dependency is types/maria.ts which is also framework-free.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { MariaResult } from '../../types/maria'

/**
 * The most recent successful MariaResult.
 * null until the first successful analysis in this browser session.
 * Not persisted to localStorage — analysis must be re-run after page refresh.
 */
export const lastMariaResult: Ref<MariaResult | null> = ref(null)
