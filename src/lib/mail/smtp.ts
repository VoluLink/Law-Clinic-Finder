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

type SmtpClientFactory = (options: SmtpTransportOptions) => SmtpClient;

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

function createNodemailerClient(options: SmtpTransportOptions): SmtpClient {
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
