import { describe, expect, it, vi } from 'vitest';

import { redactPatterns, redactTranscript } from './redact';

const transcript = [
  { role: 'user' as const, content: 'Ich bin Max Mustermann aus Berlin.' },
  { role: 'assistant' as const, content: 'Gerne helfe ich Ihnen, Herr Mustermann.' },
];

function modelReturning(payload: unknown) {
  return vi.fn().mockResolvedValue(JSON.stringify(payload));
}

describe(redactPatterns, () => {
  it('replaces email addresses', () => {
    expect(redactPatterns('Schreiben Sie an max.mustermann@web.de bitte')).toBe(
      'Schreiben Sie an [E-MAIL] bitte',
    );
  });

  it('replaces German phone numbers', () => {
    expect(redactPatterns('Rufen Sie mich an: +49 30 123456 oder 0171-2345678')).toBe(
      'Rufen Sie mich an: [TELEFON] oder [TELEFON]',
    );
  });

  it('leaves ordinary text untouched', () => {
    const text = 'Ich habe ein Problem mit meinem Mietvertrag in Berlin.';
    expect(redactPatterns(text)).toBe(text);
  });
});

describe(redactTranscript, () => {
  it('returns redacted messages plus extracted legal area and city', async () => {
    const complete = modelReturning({
      messages: [
        { role: 'user', content: 'Ich bin [NAME] aus Berlin.' },
        { role: 'assistant', content: 'Gerne helfe ich Ihnen, [NAME].' },
      ],
      legal_area: 'Mietrecht',
      city: 'Berlin',
    });
    const outcome = await redactTranscript(complete, transcript);
    expect(outcome).toEqual({
      status: 'ok',
      transcript: [
        { role: 'user', content: 'Ich bin [NAME] aus Berlin.' },
        { role: 'assistant', content: 'Gerne helfe ich Ihnen, [NAME].' },
      ],
      legalArea: 'Mietrecht',
      city: 'Berlin',
    });
  });

  it('fails when the model returns malformed JSON', async () => {
    const complete = vi.fn().mockResolvedValue('not json at all');
    expect(await redactTranscript(complete, transcript)).toEqual({ status: 'failed' });
  });

  it('fails when the model drops messages', async () => {
    const complete = modelReturning({
      messages: [{ role: 'user', content: 'nur eine' }],
      legal_area: null,
      city: null,
    });
    expect(await redactTranscript(complete, transcript)).toEqual({ status: 'failed' });
  });

  it('fails when the model call throws', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('api down'));
    expect(await redactTranscript(complete, transcript)).toEqual({ status: 'failed' });
  });

  it('scrubs emails the model missed', async () => {
    const complete = modelReturning({
      messages: [
        { role: 'user', content: 'Kontakt: max@web.de' },
        { role: 'assistant', content: 'Verstanden.' },
      ],
      legal_area: null,
      city: null,
    });
    const outcome = await redactTranscript(complete, transcript);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.transcript[0].content).toBe('Kontakt: [E-MAIL]');
    }
  });
});
