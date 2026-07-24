import { z } from 'zod';

/** German message shown when an email field receives a non-email value. */
export const INVALID_EMAIL_MESSAGE = 'Bitte gib eine gültige E-Mail-Adresse ein.';

/** Single source for email-field validation across every form and API route. */
export const emailValue = z.email({ error: INVALID_EMAIL_MESSAGE }).max(200);

/** True when `value` (after trimming) is a valid email. */
export function isValidEmail(value: string): boolean {
  return emailValue.safeParse(value.trim()).success;
}
