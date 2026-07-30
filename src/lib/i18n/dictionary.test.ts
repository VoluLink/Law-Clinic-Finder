import { describe, expect, it } from 'vitest';

import { LANGS } from './config';
import { getDictionary, type Dictionary } from './dictionary';
import { deOnly } from './locales/de';
import { en } from './locales/en';

/** The German-only half of a dictionary, keyed the same way as `deOnly`. */
function germanOnlyCopy(dict: Dictionary): Record<string, string> {
  return Object.fromEntries(Object.entries(dict).filter(([key]) => key in deOnly));
}

describe('getDictionary', () => {
  it.each(LANGS)('serves $code the German-only landing copy verbatim', ({ code }) => {
    expect(germanOnlyCopy(getDictionary(code))).toEqual({ ...deOnly });
  });

  it('keeps the requested locale for everything that is translated', () => {
    expect(getDictionary('en').navSo).toBe(en.navSo);
  });

  it('describes how the website works rather than how clinics work', () => {
    expect(getDictionary('de').soHeading).toBe('So funktioniert diese Website');
  });
});
