/**
 * Upsert a history run entry into a runs array.
 *
 * If an entry for the same date already exists, it is replaced.
 * Otherwise the new run is appended.
 *
 * Returns a new array (does not mutate the input).
 *
 * @param {Array<{date: string, commit: string, tests: number, passed: number, failed: number, coverage: number}>} runs - Existing history runs
 * @param {{date: string, commit: string, tests: number, passed: number, failed: number, coverage: number}} newRun - Run to upsert
 * @returns {Array<{date: string, commit: string, tests: number, passed: number, failed: number, coverage: number}>} Updated runs array
 */
export function upsertHistoryRun(runs, newRun) {
  const existingIndex = runs.findIndex((r) => r.date === newRun.date);
  if (existingIndex !== -1) {
    const updated = [...runs];
    updated[existingIndex] = newRun;
    return updated;
  }
  return [...runs, newRun];
}
