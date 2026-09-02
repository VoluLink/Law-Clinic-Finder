import { z } from 'zod';

const EXPECTED_PROJECT_ID = 'law-clinic-finder';
const EXPECTED_DATABASE_ID = 'primary-eu';
const IMPLICIT_TLS_PORT = 465;

type Environment = Readonly<Record<string, string | undefined>>;

export class ConfigurationError extends Error {
  constructor(readonly fields: string[]) {
    super(`Invalid server configuration: ${fields.join(', ')}`);
    this.name = 'ConfigurationError';
  }
}

const siteUrlSchema = z.url().transform((value, ctx) => {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    ctx.addIssue({ code: 'custom', message: 'Must be an origin URL without credentials' });
    return z.NEVER;
  }
  const localHttp =
    url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    ctx.addIssue({ code: 'custom', message: 'Public site URL must use HTTPS' });
    return z.NEVER;
  }
  return url.origin;
});

const firebaseSchema = z.object({
  projectId: z.literal(EXPECTED_PROJECT_ID),
  databaseId: z.literal(EXPECTED_DATABASE_ID),
  storageBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]+\.(?:appspot\.com|firebasestorage\.app)$/),
  webApiKey: z.string().min(10).max(200),
  siteUrl: siteUrlSchema,
});

const portSchema = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65_535));

const smtpSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/),
  port: portSchema,
  loginEmail: z.email().max(200),
  password: z.string().min(1).max(1_000),
  fromEmail: z.email().max(200),
  fromName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^\r\n]+$/),
});

function invalidFields(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.') || 'unknown'))];
}

function parseConfig<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ConfigurationError(invalidFields(result.error));
  return result.data;
}

export function parseFirebaseConfig(env: Environment) {
  return parseConfig(firebaseSchema, {
    projectId: env.FIREBASE_PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT ?? env.GCLOUD_PROJECT,
    databaseId: env.FIREBASE_DATABASE_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
    webApiKey: env.IDENTITY_PLATFORM_API_KEY,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
}

export function parseSmtpConfig(env: Environment) {
  const parsed = parseConfig(smtpSchema, {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    loginEmail: env.SMTP_LOGIN_EMAIL,
    password: env.SMTP_PASSWORD,
    fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_LOGIN_EMAIL,
    fromName: env.SMTP_FROM_NAME ?? 'Law Clinics Deutschland',
  });
  const secure = parsed.port === IMPLICIT_TLS_PORT;
  return { ...parsed, secure, requireTls: !secure };
}

export type SmtpConfig = ReturnType<typeof parseSmtpConfig>;

export const firebaseConfig = () => parseFirebaseConfig(process.env);
export const smtpConfig = () => parseSmtpConfig(process.env);
