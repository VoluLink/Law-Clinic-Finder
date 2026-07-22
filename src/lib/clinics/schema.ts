import { z } from 'zod';

const optionalText = (max: number) =>
  z.union([z.string().max(max), z.null()]).transform((value) => (value ?? '').trim() || null);

const optionalEmail = z
  .union([z.null(), z.literal(''), z.email().max(200)])
  .transform((value) => value || null);

const optionalUrl = z
  .union([z.null(), z.literal(''), z.url().max(500)])
  .transform((value) => value || null);

/** Fields a clinic user may edit — deliberately excludes is_published. */
export const clinicEditableSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  region: optionalText(200),
  contact_email: optionalEmail,
  website: optionalUrl,
  legal_areas: z.union([z.string().max(2000), z.null()]).transform((value) => (value ?? '').trim()),
  target_clients: optionalText(2000),
  languages: optionalText(1000),
  requirements: optionalText(4000),
});

export const clinicAdminSchema = clinicEditableSchema.extend({ is_published: z.boolean() });

/** Admin invite: the login/contact address is mandatory here. */
export const clinicInviteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact_email: z.email().max(200),
});

/**
 * Self-signup registration: name, homepage, contact email, region, legal
 * areas, target clients and languages are required; the description and
 * requirements stay optional.
 */
export const clinicSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact_email: z.email().max(200),
  website: z.url().max(500),
  region: z.string().trim().min(1).max(200),
  legal_areas: z.string().trim().min(1).max(2000),
  target_clients: z.string().trim().min(1).max(2000),
  languages: z.string().trim().min(1).max(1000),
  description: optionalText(2000),
  requirements: optionalText(4000),
});

export type ClinicEditable = z.infer<typeof clinicEditableSchema>;
export type ClinicAdmin = z.infer<typeof clinicAdminSchema>;
export type ClinicInvite = z.infer<typeof clinicInviteSchema>;
export type ClinicSubmission = z.infer<typeof clinicSubmissionSchema>;
