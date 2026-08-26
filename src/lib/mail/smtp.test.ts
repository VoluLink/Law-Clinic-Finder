import { describe, expect, it, vi } from 'vitest';

import type { SmtpAddressResolver } from './smtp-destination';
import { createSmtpMailer, SmtpDestinationError, verifySmtpConfig } from './smtp';

const PASSWORD = 'br3vo-Api-K3y-do-not-leak';
const PUBLIC_V4 = '203.0.114.10';
const PUBLIC_V6 = '2a01:111:f400:7eb::1';

const config = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  loginEmail: 'mailer@example.com',
  password: PASSWORD,
  fromEmail: 'sender@example.com',
  fromName: 'Law Clinics Deutschland',
  secure: false,
  requireTls: true,
};

function resolver(answers: { v4?: string[]; v6?: string[] }): SmtpAddressResolver {
  return {
    resolve4: vi.fn(() => Promise.resolve(answers.v4 ?? [])),
    resolve6: vi.fn(() => Promise.resolve(answers.v6 ?? [])),
  };
}

const publicResolver = () => resolver({ v4: [PUBLIC_V4] });

const message = { to: 'clinic@example.com', subject: 'Ihr Anmeldelink', text: 'Text body' };

describe(createSmtpMailer.name, () => {
  it('connects to the validated address while keeping the name as TLS identity', async () => {
    const createClient = vi.fn(() => ({ sendMail: vi.fn() }));

    await createSmtpMailer(config, { createClient, resolver: publicResolver() }).send(message);

    expect(createClient).toHaveBeenCalledWith({
      host: PUBLIC_V4,
      port: 587,
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
      auth: { user: 'mailer@example.com', pass: PASSWORD },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        servername: 'smtp-relay.brevo.com',
      },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 20_000,
    });
  });

  it('uses implicit TLS on port 465 and mandatory STARTTLS everywhere else', async () => {
    const createClient = vi.fn(() => ({ sendMail: vi.fn() }));
    const deps = { createClient, resolver: resolver({ v6: [PUBLIC_V6] }) };

    await createSmtpMailer({ ...config, port: 465, secure: false }, deps).send(message);
    await createSmtpMailer({ ...config, port: 2525, secure: true }, deps).send(message);

    expect(createClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ port: 465, secure: true, requireTLS: false }),
    );
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ port: 2525, secure: false, requireTLS: true }),
    );
  });

  it('sends mail with the configured sender', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'message-id' });
    const mailer = createSmtpMailer(config, {
      createClient: () => ({ sendMail }),
      resolver: publicResolver(),
    });

    await mailer.send({ ...message, html: '<p>HTML body</p>' });

    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'Law Clinics Deutschland', address: 'sender@example.com' },
      to: 'clinic@example.com',
      subject: 'Ihr Anmeldelink',
      text: 'Text body',
      html: '<p>HTML body</p>',
    });
  });

  it('rejects newline injection in a message subject', async () => {
    const mailer = createSmtpMailer(config, {
      createClient: () => ({ sendMail: vi.fn() }),
      resolver: publicResolver(),
    });

    await expect(
      mailer.send({ ...message, subject: 'Valid\r\nBcc: attacker@example.com' }),
    ).rejects.toThrow('Invalid e-mail message');
  });

  it('requires a text or HTML body', async () => {
    const mailer = createSmtpMailer(config, {
      createClient: () => ({ sendMail: vi.fn() }),
      resolver: publicResolver(),
    });

    await expect(
      mailer.send({ to: 'clinic@example.com', subject: 'Ihr Anmeldelink' }),
    ).rejects.toThrow('Invalid e-mail message');
  });

  it('opens no socket at all when the name resolves into a private range', async () => {
    const createClient = vi.fn(() => ({ sendMail: vi.fn() }));
    const deps = { createClient, resolver: resolver({ v4: ['10.0.0.5'] }) };

    await expect(createSmtpMailer(config, deps).send(message)).rejects.toBeInstanceOf(
      SmtpDestinationError,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('keeps the password out of a destination failure', async () => {
    const deps = { createClient: vi.fn(), resolver: resolver({ v4: ['127.0.0.1'] }) };

    const error = await createSmtpMailer(config, deps)
      .send(message)
      .catch((thrown: unknown) => thrown);

    expect(serialize(error)).not.toContain(PASSWORD);
  });
});

describe(verifySmtpConfig.name, () => {
  it('authenticates against the proposed settings without sending a message', async () => {
    const verify = vi.fn().mockResolvedValue(true);

    await expect(
      verifySmtpConfig(config, { createVerifier: () => ({ verify }), resolver: publicResolver() }),
    ).resolves.toEqual({ ok: true });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('keeps permitting a legitimate public provider so switching still works', async () => {
    const createVerifier = vi.fn(() => ({ verify: () => Promise.resolve(true) }));

    await expect(
      verifySmtpConfig(
        { ...config, host: 'smtp.office365.com' },
        { createVerifier, resolver: resolver({ v4: [PUBLIC_V4], v6: [PUBLIC_V6] }) },
      ),
    ).resolves.toEqual({ ok: true });
    expect(createVerifier).toHaveBeenCalledTimes(1);
  });

  it('refuses an IP literal host before any connection attempt', async () => {
    const createVerifier = vi.fn();

    await expect(
      verifySmtpConfig(
        { ...config, host: '169.254.169.254' },
        { createVerifier, resolver: publicResolver() },
      ),
    ).resolves.toEqual({ ok: false, failure: 'connection', reason: 'ip_literal_host' });
    expect(createVerifier).not.toHaveBeenCalled();
  });

  it('refuses a mixed answer set in which only one address is private', async () => {
    const createVerifier = vi.fn();

    await expect(
      verifySmtpConfig(config, {
        createVerifier,
        resolver: resolver({ v4: [PUBLIC_V4, '172.16.0.9'] }),
      }),
    ).resolves.toEqual({ ok: false, failure: 'connection', reason: 'blocked_destination' });
    expect(createVerifier).not.toHaveBeenCalled();
  });

  it('refuses a link-local IPv6 answer', async () => {
    await expect(
      verifySmtpConfig(config, {
        createVerifier: vi.fn(),
        resolver: resolver({ v6: ['fe80::1'] }),
      }),
    ).resolves.toMatchObject({ reason: 'blocked_destination' });
  });

  it('refuses an IPv4-mapped IPv6 answer that hides a loopback address', async () => {
    await expect(
      verifySmtpConfig(config, {
        createVerifier: vi.fn(),
        resolver: resolver({ v6: ['::ffff:127.0.0.1'] }),
      }),
    ).resolves.toMatchObject({ reason: 'blocked_destination' });
  });

  it('connects to the address it validated even when the name rebinds afterwards', async () => {
    const answers = [[PUBLIC_V4], ['169.254.169.254']];
    const rebinding: SmtpAddressResolver = {
      resolve4: vi.fn(() => Promise.resolve(answers.shift() ?? [])),
      resolve6: () => Promise.resolve([]),
    };
    const createVerifier = vi.fn(() => ({ verify: () => Promise.resolve(true) }));

    const first = await verifySmtpConfig(config, { createVerifier, resolver: rebinding });
    const second = await verifySmtpConfig(config, { createVerifier, resolver: rebinding });

    expect(createVerifier.mock.calls).toEqual([
      [expect.objectContaining({ host: PUBLIC_V4, tls: expect.objectContaining(TLS) })],
    ]);
    expect([first, second]).toEqual([
      { ok: true },
      { ok: false, failure: 'connection', reason: 'blocked_destination' },
    ]);
  });

  it('classifies a rejected login as an authentication failure', async () => {
    const error = Object.assign(new Error('Invalid login'), { code: 'EAUTH' });

    await expect(
      verifySmtpConfig(config, {
        createVerifier: () => ({ verify: () => Promise.reject(error) }),
        resolver: publicResolver(),
      }),
    ).resolves.toEqual({ ok: false, failure: 'authentication', reason: 'smtp_error' });
  });

  it('classifies a connect timeout as a connection failure', async () => {
    const error = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });

    await expect(
      verifySmtpConfig(config, {
        createVerifier: () => ({ verify: () => Promise.reject(error) }),
        resolver: publicResolver(),
      }),
    ).resolves.toEqual({ ok: false, failure: 'connection', reason: 'smtp_error' });
  });

  it('falls back to an unknown failure for an unclassified error', async () => {
    await expect(
      verifySmtpConfig(config, {
        createVerifier: () => ({ verify: () => Promise.reject(new Error('boom')) }),
        resolver: publicResolver(),
      }),
    ).resolves.toEqual({ ok: false, failure: 'unknown', reason: 'smtp_error' });
  });

  it('never echoes the password or the host that a server put into its error', async () => {
    const leaky = new Error(`535 auth failed for mailer@example.com:${PASSWORD} at ${PUBLIC_V4}`);

    const result = await verifySmtpConfig(config, {
      createVerifier: () => ({ verify: () => Promise.reject(leaky) }),
      resolver: publicResolver(),
    });

    expect(serialize(result)).toBe('{"ok":false,"failure":"unknown","reason":"smtp_error"}');
  });
});

const TLS = { rejectUnauthorized: true, servername: 'smtp-relay.brevo.com' };

function serialize(value: unknown): string {
  return JSON.stringify(value, Object.getOwnPropertyNames(value ?? {}));
}
