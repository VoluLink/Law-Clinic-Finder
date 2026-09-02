import { z } from 'zod';

import { MAX_EXTERNAL_URL_LENGTH, safeExternalHref } from '@/lib/http/external-url';

const nullableText = (max: number) => z.string().max(max).nullable();

function firestoreDate(value: unknown, ctx: z.RefinementCtx): Date {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value !== 'object' || value === null || !('toDate' in value)) {
    ctx.addIssue({ code: 'custom', message: 'Expected a Firestore timestamp' });
    return z.NEVER;
  }
  const toDate = value.toDate;
  const date = typeof toDate === 'function' ? toDate.call(value) : null;
  if (date instanceof Date && !Number.isNaN(date.valueOf())) return date;
  ctx.addIssue({ code: 'custom', message: 'Invalid Firestore timestamp' });
  return z.NEVER;
}

export const firestoreDateSchema = z.unknown().transform(firestoreDate);

export const clinicDocumentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: nullableText(2000),
    region: nullableText(1000),
    /* Read-side scheme guard. The write schemas already reject anything but
       http(s), so a value that reaches here came from the historical data import
       or a direct console edit. Nulling the link keeps the clinic listed instead
       of failing the parse and taking the whole directory down with it. */
    website: z.url().max(MAX_EXTERNAL_URL_LENGTH).nullable().transform(safeExternalHref),
    legalAreas: z.string().max(2000),
    targetClients: nullableText(2000),
    languages: nullableText(1000),
    requirements: nullableText(4000),
    advisesClients: z.boolean(),
    isPublished: z.boolean(),
    approvalStatus: z.enum(['pending', 'approved']),
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema,
    /* Transactional notice marks. Absent on every document written before the
       notifications existed, so both stay optional rather than defaulted. */
    submissionNotifiedAt: firestoreDateSchema.nullish(),
    publishNotifiedAt: firestoreDateSchema.nullish(),
    /* Self-service visibility. `hiddenUntil` set means a temporary pause that a
       scheduled job restores; null with reason 'permanent' means the clinic hid
       itself indefinitely and can republish whenever it wants. Both are absent on
       every document written before this existed. */
    hiddenUntil: firestoreDateSchema.nullish(),
    hiddenReason: z.enum(['temporary', 'permanent']).nullish(),
  })
  .strict()
  .refine((clinic) => clinic.approvalStatus === 'approved' || !clinic.isPublished, {
    path: ['isPublished'],
    message: 'A pending clinic cannot be published',
  });

export const clinicContactDocumentSchema = z
  .object({
    contactEmail: z
      .string()
      .trim()
      .email()
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export const profileDocumentSchema = z
  .object({
    role: z.enum(['admin', 'clinic']),
    clinicId: z.string().uuid().nullable(),
    accessStatus: z.enum(['pending', 'active']),
    activatedAt: firestoreDateSchema.nullable(),
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema,
  })
  .strict()
  .refine((profile) => profile.role !== 'clinic' || profile.clinicId !== null, {
    path: ['clinicId'],
    message: 'A clinic profile must reference a clinic',
  });

export const settingDocumentSchema = z
  .object({ values: z.record(z.string().max(100), z.json()), updatedAt: firestoreDateSchema })
  .strict();

export const brandingDocumentSchema = z
  .object({
    wordmark: z.string().min(1).max(100),
    logoPath: nullableText(500),
    colorPrimary: z.string().regex(/^#[0-9a-f]{6}$/i),
    colorBackground: z.string().regex(/^#[0-9a-f]{6}$/i),
    colorAccent: z.string().regex(/^#[0-9a-f]{6}$/i),
    colorForeground: z.string().regex(/^#[0-9a-f]{6}$/i),
    font: z.string().min(1).max(100),
    updatedAt: firestoreDateSchema,
  })
  .strict();

export type ClinicDocument = z.infer<typeof clinicDocumentSchema>;
export type ProfileDocument = z.infer<typeof profileDocumentSchema>;
export type BrandingDocument = z.infer<typeof brandingDocumentSchema>;
