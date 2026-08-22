import { describe, expect, it, vi } from 'vitest';

import { createSmtpMailer } from './smtp';

const config = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  loginEmail: 'mailer@example.com',
  password: 'secret',
  fromEmail: 'sender@example.com',
  fromName: 'Law Clinics Deutschland',
  secure: false,
  requireTls: true,
};

describe(createSmtpMailer.name, () => {
  it('creates a STARTTLS transport from provider-neutral settings', () => {
    const factory = vi.fn(() => ({ sendMail: vi.fn() }));

    createSmtpMailer(config, factory);

    expect(factory).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'mailer@example.com', pass: 'secret' },
      tls: { minVersion: 'TLSv1.2' },
    });
  });

  it('sends mail with the configured sender', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'message-id' });
    const mailer = createSmtpMailer(config, () => ({ sendMail }));

    await mailer.send({
      to: 'clinic@example.com',
      subject: 'Ihr Anmeldelink',
      text: 'Text body',
      html: '<p>HTML body</p>',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'Law Clinics Deutschland', address: 'sender@example.com' },
      to: 'clinic@example.com',
      subject: 'Ihr Anmeldelink',
      text: 'Text body',
      html: '<p>HTML body</p>',
    });
  });

  it('rejects newline injection in a message subject', async () => {
    const mailer = createSmtpMailer(config, () => ({ sendMail: vi.fn() }));

    await expect(
      mailer.send({
        to: 'clinic@example.com',
        subject: 'Valid\r\nBcc: attacker@example.com',
        text: 'x',
      }),
    ).rejects.toThrow('Invalid e-mail message');
  });

  it('requires a text or HTML body', async () => {
    const mailer = createSmtpMailer(config, () => ({ sendMail: vi.fn() }));

    await expect(
      mailer.send({ to: 'clinic@example.com', subject: 'Ihr Anmeldelink' }),
    ).rejects.toThrow('Invalid e-mail message');
  });
});
