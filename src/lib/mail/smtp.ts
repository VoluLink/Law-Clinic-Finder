import 'server-only';

import nodemailer from 'nodemailer';
import { z } from 'zod';

import { smtpConfig } from '@/lib/firebase/env';
import type { SmtpConfig } from '@/lib/firebase/env';

import {
  resolveSmtpDestination,
  SMTP_DESTINATION_REJECTIONS,
  type SmtpAddressResolver,
  type SmtpDestinationRejection,
} from './smtp-destination';

/** Implicit TLS on connect. Every other port has to complete STARTTLS instead. */
const IMPLICIT_TLS_PORT = 465;

/** Short enough that a dead or filtered destination cannot pin an instance down. */
const CONNECTION_TIMEOUT_MS = 8_000;
const GREETING_TIMEOUT_MS = 8_000;
const SOCKET_TIMEOUT_MS = 20_000;

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
  /** The address that was just validated, never the name: nodemailer skips its
   *  own cached lookup for an IP literal, so the name cannot rebind under us. */
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  ignoreTLS: false;
  auth: { user: string; pass: string };
  tls: { minVersion: 'TLSv1.2'; rejectUnauthorized: true; servername: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
};

type SmtpClient = {
  sendMail(message: MailMessage & { from: { name: string; address: string } }): Promise<unknown>;
};

/** `verify()` opens the connection and authenticates without sending anything. */
type SmtpVerifier = { verify(): Promise<unknown> };

type SmtpClientFactory = (options: SmtpTransportOptions) => SmtpClient;
type SmtpVerifierFactory = (options: SmtpTransportOptions) => SmtpVerifier;

/** Injected so tests and the emulator never resolve a name or open a socket. */
export type SmtpMailerDeps = {
  createClient: SmtpClientFactory;
  resolver: SmtpAddressResolver;
};

export type SmtpVerifierDeps = {
  createVerifier: SmtpVerifierFactory;
  resolver: SmtpAddressResolver;
};

/**
 * TLS is derived from the port rather than taken from the configuration, so no
 * stored or environment setting can downgrade a connection that carries the
 * SMTP password. The certificate is checked against the configured name even
 * though the socket goes to the pinned address.
 */
function transportOptions(config: SmtpConfig, address: string): SmtpTransportOptions {
  const secure = config.port === IMPLICIT_TLS_PORT;
  return {
    host: address,
    port: config.port,
    secure,
    requireTLS: !secure,
    ignoreTLS: false,
    auth: { user: config.loginEmail, pass: config.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: config.host },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
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

/** Carries the coarse rejection only — never the host, address, or credentials. */
export class SmtpDestinationError extends Error {
  constructor(readonly rejection: SmtpDestinationRejection) {
    super('SMTP destination rejected');
    this.name = 'SmtpDestinationError';
  }
}

export function createSmtpMailer(
  config: SmtpConfig = smtpConfig(),
  deps: Partial<SmtpMailerDeps> = {},
) {
  const createClient = deps.createClient ?? createNodemailerClient;
  return {
    async send(input: MailMessage) {
      const result = mailMessageSchema.safeParse(input);
      if (!result.success) throw new MailMessageError();
      const destination = await resolveSmtpDestination(config.host, deps.resolver);
      if (!destination.ok) throw new SmtpDestinationError(destination.rejection);
      const from = { name: config.fromName, address: config.fromEmail };
      await createClient(transportOptions(config, destination.address)).sendMail({
        from,
        ...result.data,
      });
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

/** A closed set, so a server-supplied error string can never reach a log or a
 *  response: SMTP servers echo the login and sometimes the offered secret. */
export const SMTP_VERIFICATION_REASONS = [...SMTP_DESTINATION_REJECTIONS, 'smtp_error'] as const;

export type SmtpVerificationReason = (typeof SMTP_VERIFICATION_REASONS)[number];

export type SmtpVerificationResult =
  { ok: true } | { ok: false; failure: SmtpVerificationFailure; reason: SmtpVerificationReason };

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
 * Never sends a message, so a wrong setting cannot reach a real recipient. A
 * blocked destination reports the same coarse `connection` failure as an
 * unreachable one, so the admin screen cannot be used to map internal networks.
 */
export async function verifySmtpConfig(
  config: SmtpConfig,
  deps: Partial<SmtpVerifierDeps> = {},
): Promise<SmtpVerificationResult> {
  const destination = await resolveSmtpDestination(config.host, deps.resolver);
  if (!destination.ok) {
    return { ok: false, failure: 'connection', reason: destination.rejection };
  }
  const createVerifier = deps.createVerifier ?? createNodemailerClient;
  try {
    await createVerifier(transportOptions(config, destination.address)).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, failure: verificationFailure(error), reason: 'smtp_error' };
  }
}
