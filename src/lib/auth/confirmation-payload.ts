import { z } from 'zod';

export const confirmationPayloadSchema = z
  .object({
    oobCode: z.string().min(10).max(2_000),
    state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    flow: z.enum(['email-change']).optional(),
  })
  .strict();

export type ConfirmationPayload = z.infer<typeof confirmationPayloadSchema>;

export const confirmationDestinationSchema = z.enum([
  '/admin',
  '/clinic',
  '/clinic/pending',
  '/login?email_changed=1',
  '/login?error=1',
  '/login?error=no_access',
]);

export type ConfirmationDestination = z.infer<typeof confirmationDestinationSchema>;

export function confirmationPayloadFromFragment(fragment: string): ConfirmationPayload | null {
  const params = new URLSearchParams(fragment.startsWith('#') ? fragment.slice(1) : fragment);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return null;
  const parsed = confirmationPayloadSchema.safeParse(Object.fromEntries(params));
  return parsed.success ? parsed.data : null;
}

export function confirmationLink(siteUrl: string, input: ConfirmationPayload): string {
  const payload = confirmationPayloadSchema.parse(input);
  const url = new URL('/auth/confirm', siteUrl);
  const entries = Object.entries(payload).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  );
  url.hash = new URLSearchParams(entries).toString();
  return url.toString();
}
