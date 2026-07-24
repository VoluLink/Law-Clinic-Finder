/**
 * Collapse a Zod issue list into one message per field, keyed by the first path
 * segment — what a form needs to mark each input. Shared by every form that maps
 * validation issues onto its fields.
 */
export function fieldErrorsFrom<K extends string = string>(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in result)) result[key as K] = issue.message;
  }
  return result;
}
