import { z } from 'zod';

import { emailValue } from '@/lib/forms/email';
import { externalUrlSchema } from '@/lib/http/external-url';

import { memberBlockers } from './publish-requirements';

const optionalText = (max: number) =>
  z.union([z.string().max(max), z.null()]).transform((value) => (value ?? '').trim() || null);

const optionalEmail = z
  .union([z.null(), z.literal(''), emailValue])
  .transform((value) => value || null);

/** Named for its callers; the rule itself is shared with the read codecs. */
export const publicWebsiteUrlSchema = externalUrlSchema;

const optionalUrl = z
  .union([z.null(), z.literal(''), publicWebsiteUrlSchema])
  .transform((value) => value || null);

/**
 * Fields a clinic user may edit — deliberately excludes is_published. Lenient on
 * purpose: it parses possibly-incomplete stored rows for display and backs the
 * admin partial PATCH. Completeness is enforced by clinicMemberSaveSchema and the
 * publish gate, not here.
 */
export const clinicEditableSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  // Region is multi-value ("; "-joined cities), so it needs headroom beyond one name.
  region: optionalText(1000),
  contact_email: optionalEmail,
  website: optionalUrl,
  legal_areas: z.union([z.string().max(2000), z.null()]).transform((value) => (value ?? '').trim()),
  target_clients: optionalText(2000),
  languages: optionalText(1000),
  requirements: optionalText(4000),
  // Beratungsarbeit: does the clinic advise clients? false ⇒ description must
  // explain the alternative service (enforced on save/publish, not here).
  advises_clients: z.boolean().default(true),
});

export const clinicAdminSchema = clinicEditableSchema.extend({ is_published: z.boolean() });

/** German message for a required field left blank on save/registration. */
function requiredMessage(key: string): string {
  return key === 'description'
    ? 'Bitte erläutere, welche Leistung du stattdessen anbietest.'
    : 'Pflichtfeld.';
}

/**
 * A clinic member saving their own entry must provide the full required set
 * (and, when they do not advise clients, the alternative-service text). Wraps the
 * lenient editable schema with per-field issues so the form can mark each blank.
 */
export const clinicMemberSaveSchema = clinicEditableSchema.superRefine((value, ctx) => {
  for (const key of memberBlockers(value)) {
    ctx.addIssue({ code: 'custom', path: [key], message: requiredMessage(key) });
  }
});

/** Admin invite: the login/contact address is mandatory here. */
export const clinicInviteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact_email: emailValue,
});

/**
 * Self-signup registration: name, homepage, contact email, region, legal areas,
 * target clients and languages are required. Beratungsarbeit is required as a
 * Ja/Nein choice; "Nein" additionally requires the alternative-service text.
 * requirements stays optional.
 */
export const clinicSubmissionSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    contact_email: emailValue,
    website: publicWebsiteUrlSchema,
    region: z.string().trim().min(1).max(1000),
    legal_areas: z.string().trim().min(1).max(2000),
    target_clients: z.string().trim().min(1).max(2000),
    languages: z.string().trim().min(1).max(1000),
    advises_clients: z.boolean(),
    description: optionalText(2000),
    requirements: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    if (value.advises_clients === false && !value.description) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: requiredMessage('description'),
      });
    }
  });

export type ClinicEditable = z.infer<typeof clinicEditableSchema>;
export type ClinicAdmin = z.infer<typeof clinicAdminSchema>;
export type ClinicInvite = z.infer<typeof clinicInviteSchema>;
export type ClinicSubmission = z.infer<typeof clinicSubmissionSchema>;
