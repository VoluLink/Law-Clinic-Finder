import { createHash } from 'node:crypto';

export function metricBucketId(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
