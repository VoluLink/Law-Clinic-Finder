import { z } from 'zod';

/**
 * Google Cloud resource identifiers that reach a request URL.
 *
 * Every one of these calls carries a `cloud-platform` access token, so a value
 * that escapes its path segment does more than produce a 404: with a location
 * spliced into `secretmanager.{location}.rep.googleapis.com` it decides which
 * host receives the token. They all come from deployment environment variables
 * rather than from a user, so this is a configuration guard rather than an
 * input filter — but the failure it prevents is silent, and a typo is the
 * likeliest way to reach it.
 */

/** 6–30 characters, starting with a lowercase letter, no trailing hyphen. */
export const googleProjectIdSchema = z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);

/** A location id: `europe-west4`, `us-central1`, `eu`, `global`. */
export const googleLocationSchema = z.string().regex(/^[a-z]{2,}(?:-[a-z]+\d)?$/);

/** Secret Manager ids allow letters, digits, hyphens and underscores. */
export const googleSecretIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,255}$/);

/** Secret versions are the numeric ids Secret Manager assigns, or `latest`. */
export const googleSecretVersionSchema = z.union([
  z.string().regex(/^\d{1,19}$/),
  z.literal('latest'),
]);
