/**
 * `kontakt@milcc.de` → `k****t@milcc.de`. Fixed-width mask so the local-part
 * length is not leaked; the domain stays readable so the clinic recognises
 * its own address.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '****';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const last = local.length > 1 ? local[local.length - 1] : '';
  return `${local[0]}****${last}@${domain}`;
}
