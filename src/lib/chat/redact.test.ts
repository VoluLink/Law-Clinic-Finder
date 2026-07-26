import { describe, expect, it } from 'vitest';

import { redactPatterns, redactTranscript } from './redact';

describe(redactPatterns, () => {
  it('replaces email addresses', () => {
    expect(redactPatterns('Schreiben Sie an max.mustermann@web.de bitte')).toBe(
      'Schreiben Sie an [E-MAIL] bitte',
    );
  });

  it('replaces a commonly obfuscated email address', () => {
    expect(redactPatterns('Meine Mail ist anna (at) beispiel (punkt) de.')).toBe(
      'Meine Mail ist [E-MAIL].',
    );
  });

  it('replaces German phone numbers', () => {
    expect(redactPatterns('Rufen Sie mich an: +49 30 123456 oder 0171-2345678')).toBe(
      'Rufen Sie mich an: [TELEFON] oder [TELEFON]',
    );
  });

  it('does not mistake a date for a phone number', () => {
    expect(redactPatterns('Die Kündigung kam am 01.07.2026.')).toBe(
      'Die Kündigung kam am 01.07.2026.',
    );
  });

  it.each([
    ['Mein Name ist Max Mustermann.', 'Mein Name ist [NAME].'],
    ['Name: Max Mustermann.', 'Name: [NAME].'],
    ['Ich heiße Ayşe Yılmaz.', 'Ich heiße [NAME].'],
    ['Die Vermieterin heißt Erika Muster.', 'Die Vermieterin heißt [NAME].'],
    ['Schreiben von Herrn Dr. Max Mustermann.', 'Schreiben von [NAME].'],
  ])('replaces a name in an explicit name context', (input, expected) => {
    expect(redactPatterns(input)).toBe(expected);
  });

  it.each([
    ['Ich wohne in der Musterstraße 12a in Köln.', 'Ich wohne in der [ADRESSE] in Köln.'],
    ['Meine Anschrift ist Am Markt 5, Berlin.', 'Meine Anschrift ist [ADRESSE], Berlin.'],
    ['Die Adresse ist Straße des 17. Juni 135, Berlin.', 'Die Adresse ist [ADRESSE], Berlin.'],
  ])('replaces a German street address but keeps the city', (input, expected) => {
    expect(redactPatterns(input)).toBe(expected);
  });

  it('replaces an IBAN', () => {
    expect(redactPatterns('Mein Konto ist DE89 3704 0044 0532 0130 00.')).toBe(
      'Mein Konto ist [IBAN].',
    );
  });

  it('leaves ordinary text untouched', () => {
    const text = 'Ich habe ein Problem mit meinem Mietvertrag in Berlin.';
    expect(redactPatterns(text)).toBe(text);
  });
});

describe(redactTranscript, () => {
  it('redacts locally and extracts controlled analytics terms', async () => {
    const transcript = [
      {
        role: 'user' as const,
        content: 'Ich bin Max Mustermann aus Berlin. Es geht um Mietrecht.',
      },
      { role: 'assistant' as const, content: 'Gerne helfe ich Ihnen, Herr Mustermann.' },
    ];
    await expect(redactTranscript(transcript)).resolves.toEqual({
      status: 'ok',
      transcript: [
        { role: 'user', content: 'Ich bin [NAME] aus Berlin. Es geht um Mietrecht.' },
        { role: 'assistant', content: 'Gerne helfe ich Ihnen, [NAME].' },
      ],
      legalArea: 'Mietrecht',
      city: 'Berlin',
    });
  });
});
