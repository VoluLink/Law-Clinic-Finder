import { describe, expect, it } from 'vitest';

import { fieldErrorsFrom } from './field-errors';

describe('fieldErrorsFrom', () => {
  it('keeps the first message per field', () => {
    const errors = fieldErrorsFrom([
      { path: ['website'], message: 'Pflichtfeld.' },
      { path: ['website'], message: 'Zweiter Fehler.' },
      { path: ['region'], message: 'Fehlt.' },
    ]);
    expect(errors).toEqual({ website: 'Pflichtfeld.', region: 'Fehlt.' });
  });

  it('ignores issues without a string field path', () => {
    expect(fieldErrorsFrom([{ path: [], message: 'Formfehler.' }])).toEqual({});
  });
});
