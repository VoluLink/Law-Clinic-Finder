import 'server-only';

import nodemailer from 'nodemailer';
import { z } from 'zod';

import { smtpConfig } from '@/lib/firebase/env';
import type { SmtpConfig } from '@/lib/firebase/env';

const mailMessageSchema = z
  .object({
    to: z.email().max(200),
    subject: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\r\n]+$/),
    text: z.string().min(1).max(100_000).optional(),
    html: z.string().min(1).max(200_000).optional(),
  })
  .refine((message) => message.text || message.html, { message: 'A body is required' });

type MailMessage = z.infer<typeof mailMessageSchema>;

type SmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
  tls: { minVersion: 'TLSv1.2' };
};

type SmtpClient = {
  sendMail(message: MailMessage & { from: { name: string; address: string } }): Promise<unknown>;
};

/** `verify()` opens the connection and authenticates without sending anything. */
type SmtpVerifier = { verify(): Promise<unknown> };

type SmtpClientFactory = (options: SmtpTransportOptions) => SmtpClient;
type SmtpVerifierFactory = (options: SmtpTransportOptions) => SmtpVerifier;

function transportOptions(config: SmtpConfig): SmtpTransportOptions {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: { user: config.loginEmail, pass: config.password },
    tls: { minVersion: 'TLSv1.2' },
  };
}

function createNodemailerClient(options: SmtpTransportOptions): SmtpClient & SmtpVerifier {
  return nodemailer.createTransport(options);
}

export class MailMessageError extends Error {
  constructor() {
    super('Invalid e-mail message');
    this.name = 'MailMessageError';
  }
}

export function createSmtpMailer(
  config: SmtpConfig = smtpConfig(),
  createClient: SmtpClientFactory = createNodemailerClient,
) {
  const client = createClient(transportOptions(config));
  return {
    async send(input: MailMessage) {
      const result = mailMessageSchema.safeParse(input);
      if (!result.success) throw new MailMessageError();
      const from = { name: config.fromName, address: config.fromEmail };
      await client.sendMail({ from, ...result.data });
    },
  };
}

export type Mailer = ReturnType<typeof createSmtpMailer>;

/** Coarse, secret-free classification for the admin UI and the audit log. */
export const SMTP_VERIFICATION_FAILURES = [
  'authentication',
  'connection',
  'tls',
  'unknown',
] as const;

export type SmtpVerificationFailure = (typeof SMTP_VERIFICATION_FAILURES)[number];

export type SmtpVerificationResult =
  { ok: true } | { ok: false; failure: SmtpVerificationFailure; reason: string };

const FAILURE_BY_CODE: Record<string, SmtpVerificationFailure> = {
  EAUTH: 'authentication',
  ECONNECTION: 'connection',
  ESOCKET: 'connection',
  EDNS: 'connection',
  ETIMEDOUT: 'connection',
  ETLS: 'tls',
};

function verificationFailure(error: unknown): SmtpVerificationFailure {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? (FAILURE_BY_CODE[code] ?? 'unknown') : 'unknown';
}

/**
 * Proves host, TLS mode, and credentials before a configuration is activated.
 * Never sends a message, so a wrong setting cannot reach a real recipient.
 */
export async function verifySmtpConfig(
  config: SmtpConfig,
  createVerifier: SmtpVerifierFactory = createNodemailerClient,
): Promise<SmtpVerificationResult> {
  try {
    await createVerifier(transportOptions(config)).verify();
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    return { ok: false, failure: verificationFailure(error), reason };
  }
}
