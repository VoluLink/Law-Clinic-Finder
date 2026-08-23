/**
 * Brings temporarily hidden clinic entries back on their chosen day.
 *
 * The query is `hiddenUntil <= now`, which needs only the automatic single-field
 * index. `hiddenUntil` is cleared in the same write, so an entry can never be
 * restored twice and a failed run simply retries on the next tick.
 */
export type ClinicRestoreRow = { id: string; approvalStatus: string };

export type RestoreDependencies = {
  dueClinics: (now: Date) => Promise<ClinicRestoreRow[]>;
  republish: (ids: string[]) => Promise<void>;
  clearMark: (ids: string[]) => Promise<void>;
};

export type RestoreOutcome = { restored: number; skipped: number };

/**
 * An entry whose approval was withdrawn while it was paused must not reappear.
 * Its mark is still cleared, otherwise the query would return it on every run
 * forever.
 */
export async function restoreDueClinics(
  deps: RestoreDependencies,
  now = new Date(),
): Promise<RestoreOutcome> {
  const due = await deps.dueClinics(now);
  if (due.length === 0) return { restored: 0, skipped: 0 };
  const restorable = due.filter((clinic) => clinic.approvalStatus === 'approved');
  const skipped = due.filter((clinic) => clinic.approvalStatus !== 'approved');
  if (restorable.length > 0) await deps.republish(restorable.map((clinic) => clinic.id));
  if (skipped.length > 0) await deps.clearMark(skipped.map((clinic) => clinic.id));
  return { restored: restorable.length, skipped: skipped.length };
}
