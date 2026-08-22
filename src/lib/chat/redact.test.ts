import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { redactPatterns, redactTranscript } from './redact';

const DIGIT_CHARACTERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Independent oracle for ISO 7064 MOD 11,10, the check digit of the German tax id.
function taxIdCheckDigit(prefix: string): number {
  let product = 10;
  for (const character of prefix) {
    const remainder = (Number(character) + product) % 10;
    product = (2 * (remainder === 0 ? 10 : remainder)) % 11;
  }
  return (11 - product) % 10;
}

function luhnCheckDigit(body: string): number {
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body.charAt(body.length - 1 - index));
    const weighted = index % 2 === 0 ? digit * 2 : digit;
    sum += weighted > 9 ? weighted - 9 : weighted;
  }
  return (10 - (sum % 10)) % 10;
}

function germanIbanCheckDigits(bban: string): string {
  let remainder = 0;
  for (const character of `${bban}131400`) {
    remainder = (remainder * 10 + Number(character)) % 97;
  }
  return String(98 - remainder).padStart(2, '0');
}

const taxIdArbitrary = fc
  .tuple(
    fc.shuffledSubarray(DIGIT_CHARACTERS, { minLength: 9, maxLength: 9 }),
    fc.nat({ max: 8 }),
    fc.nat({ max: 9 }),
  )
  .map(([distinct, repeatedIndex, insertIndex]) => {
    const prefix = [...distinct];
    prefix.splice(insertIndex, 0, distinct[repeatedIndex]);
    return prefix.join('');
  })
  .filter((prefix) => !prefix.startsWith('0'))
  .map((prefix) => `${prefix}${taxIdCheckDigit(prefix)}`);

const creditCardArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 12, maxLength: 18 })
  .map((digits) => digits.join(''))
  .map((body) => `${body}${luhnCheckDigit(body)}`);

const germanIbanArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 18, maxLength: 18 })
  .map((digits) => digits.join(''))
  .map((bban) => `DE${germanIbanCheckDigits(bban)}${bban}`);

describe(redactPatterns, () => {
  it('replaces email addresses', () => {
    expect(redactPatterns('Schreiben Sie an max.mustermann@example.org bitte')).toBe(
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

  it('replaces only the IBAN when the following words could extend the match', () => {
    expect(
      redactPatterns('Mein Konto ist DE89 3704 0044 0532 0130 00 und die Bank fragt nach.'),
    ).toBe('Mein Konto ist [IBAN] und die Bank fragt nach.');
  });

  it('keeps a bank-like code whose IBAN checksum is wrong', () => {
    expect(redactPatterns('Die Kennung DE00 1234 5678 9012 3456 78 ist ungültig.')).toBe(
      'Die Kennung DE00 1234 5678 9012 3456 78 ist ungültig.',
    );
  });

  it('replaces a German tax identification number', () => {
    expect(redactPatterns('Meine steuerliche Identifikationsnummer ist 86095742719.')).toBe(
      'Meine steuerliche Identifikationsnummer ist [STEUER-ID].',
    );
  });

  it('keeps an eleven-digit number that fails the tax identification checksum', () => {
    expect(redactPatterns('Die Bestellnummer 86095742710 wurde storniert.')).toBe(
      'Die Bestellnummer 86095742710 wurde storniert.',
    );
  });

  it('replaces a Sozialversicherungsnummer', () => {
    expect(redactPatterns('Meine Sozialversicherungsnummer lautet 65170439K364.')).toBe(
      'Meine Sozialversicherungsnummer lautet [SOZIALVERSICHERUNG].',
    );
  });

  it('replaces a credit card number that satisfies Luhn', () => {
    expect(redactPatterns('Ich habe mit der Karte 4111 1111 1111 1111 bezahlt.')).toBe(
      'Ich habe mit der Karte [KREDITKARTE] bezahlt.',
    );
  });

  it('keeps a sixteen-digit number that fails Luhn', () => {
    expect(redactPatterns('Die Vorgangsnummer 4111111111111112 wurde erfasst.')).toBe(
      'Die Vorgangsnummer 4111111111111112 wurde erfasst.',
    );
  });

  it.each([
    ['Ich wurde geboren am 03.05.1985 in Köln.', 'Ich wurde geboren am [GEBURTSDATUM] in Köln.'],
    [
      'Geburtsdatum: 12.03.1970, wohnhaft in Berlin.',
      'Geburtsdatum: [GEBURTSDATUM], wohnhaft in Berlin.',
    ],
    ['Der Mieter ist geb. 1. April 1962.', 'Der Mieter ist geb. [GEBURTSDATUM].'],
  ])('replaces a date of birth only where it is marked as one', (input, expected) => {
    expect(redactPatterns(input)).toBe(expected);
  });

  it('replaces a court case number', () => {
    expect(redactPatterns('Das Verfahren läuft beim Amtsgericht unter 8 C 1234/22.')).toBe(
      'Das Verfahren läuft beim Amtsgericht unter [AKTENZEICHEN].',
    );
  });

  it('replaces a case number introduced by its label', () => {
    expect(redactPatterns('Aktenzeichen 2024/0815 liegt vor.')).toBe(
      'Aktenzeichen [AKTENZEICHEN] liegt vor.',
    );
  });

  it('replaces a German licence plate', () => {
    expect(redactPatterns('Mein Auto mit dem Kennzeichen K-AB 1234 wurde abgeschleppt.')).toBe(
      'Mein Auto mit dem Kennzeichen [KENNZEICHEN] wurde abgeschleppt.',
    );
  });

  it('replaces a postal code together with its city', () => {
    expect(redactPatterns('Meine Anschrift lautet 50667 Köln.')).toBe(
      'Meine Anschrift lautet [PLZ-ORT].',
    );
  });

  it('replaces a German identity card number', () => {
    expect(redactPatterns('Meine Personalausweisnummer ist L01X00T47.')).toBe(
      'Meine Personalausweisnummer ist [AUSWEIS].',
    );
  });

  it('replaces a passport number introduced by its label', () => {
    expect(redactPatterns('Reisepassnummer: C01X00T47 ist eingetragen.')).toBe(
      'Reisepassnummer: [AUSWEIS] ist eingetragen.',
    );
  });

  it.each([
    'Die Kündigung stützt sich auf § 573 Abs. 2 BGB.',
    'Die Frist endet am 15.03.2026.',
    'Die Nachzahlung beträgt 1.250,00 EUR.',
    'Az. ist noch nicht vergeben.',
    'Die Norm DIN-EN 1234 gilt weiterhin.',
    'Ich zahle 45000 Euro Abfindung.',
    'Ich habe ein Problem mit meinem Mietvertrag in Berlin.',
  ])('leaves legal vocabulary and ordinary numbers untouched: %s', (text) => {
    expect(redactPatterns(text)).toBe(text);
  });

  it('never leaks a valid tax identification number', () => {
    fc.assert(
      fc.property(taxIdArbitrary, (taxId) => {
        expect(
          redactPatterns(`Meine steuerliche Identifikationsnummer ist ${taxId}.`),
        ).not.toContain(taxId);
      }),
    );
  });

  it('never leaks a card number that satisfies Luhn', () => {
    fc.assert(
      fc.property(creditCardArbitrary, (cardNumber) => {
        expect(redactPatterns(`Ich habe mit der Karte ${cardNumber} bezahlt.`)).not.toContain(
          cardNumber,
        );
      }),
    );
  });

  it('never leaks a valid German IBAN', () => {
    fc.assert(
      fc.property(germanIbanArbitrary, (iban) => {
        expect(redactPatterns(`Meine IBAN lautet ${iban}.`)).not.toContain(iban);
      }),
    );
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
