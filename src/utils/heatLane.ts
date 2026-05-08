// UNIT_TYPE=Utility
// Feature #46 — Spec "heat lane" distribution helper

/**
 * Distributes an array of entries evenly across `numColumns` columns.
 * Entry at index `i` goes into column `i % numColumns`.
 * Returns an array-of-arrays, length === numColumns (empty arrays for columns with no entries).
 */
export function distributeEntries<T>(entries: T[], numColumns: number): T[][] {
  if (numColumns <= 0) return []
  const columns: T[][] = Array.from({ length: numColumns }, () => [])
  entries.forEach((entry, i) => {
    columns[i % numColumns].push(entry)
  })
  return columns
}
