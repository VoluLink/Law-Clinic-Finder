import { createHash } from 'node:crypto';

export function clinicNameReservationId(name: string): string {
  const normalized = name.trim().normalize('NFKC').toLocaleLowerCase('de');
  return createHash('sha256').update(normalized).digest('hex');
}
