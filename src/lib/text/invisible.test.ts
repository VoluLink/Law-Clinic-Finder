import { describe, expect, it } from 'vitest';

import { stripInvisible, stripInvisibleAndZeroWidth } from './invisible';

const RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const POP_DIRECTIONAL = '\u202C';
const FIRST_STRONG_ISOLATE = '\u2068';
const ZERO_WIDTH_NON_JOINER = '\u200C';
const RIGHT_TO_LEFT_MARK = '\u200F';
const ZERO_WIDTH_SPACE = '\u200B';

describe(stripInvisible, () => {
  it('removes a bidi override that would reverse how the text reads', () => {
    const spoofed = `Rufen Sie ${RIGHT_TO_LEFT_OVERRIDE}ed.lieopmi${POP_DIRECTIONAL} an`;
    expect(stripInvisible(spoofed)).toBe('Rufen Sie ed.lieopmi an');
  });

  it('removes a directional isolate', () => {
    expect(stripInvisible(`a${FIRST_STRONG_ISOLATE}b`)).toBe('ab');
  });

  it('removes C0 controls but keeps tab, newline and carriage return', () => {
    expect(stripInvisible('a\u0000b\u0007c\td\ne\rf')).toBe('abc\td\ne\rf');
  });

  it('removes the byte-order mark', () => {
    expect(stripInvisible('\uFEFFKöln')).toBe('Köln');
  });

  it('keeps the zero-width non-joiner that Farsi needs to render', () => {
    const farsi = `می${ZERO_WIDTH_NON_JOINER}رود`;
    expect(stripInvisible(farsi)).toBe(farsi);
  });

  it('keeps the right-to-left mark that fixes direction in mixed text', () => {
    const mixed = `Law Clinic Köln ${RIGHT_TO_LEFT_MARK}القانون`;
    expect(stripInvisible(mixed)).toBe(mixed);
  });

  it('leaves ordinary German prose byte-identical', () => {
    const prose = 'Straßenverkehrsrecht in Köln – 50667 – für Studierende.';
    expect(stripInvisible(prose)).toBe(prose);
  });
});

describe(stripInvisibleAndZeroWidth, () => {
  it('also removes the zero-width characters left in place for visitor text', () => {
    expect(stripInvisibleAndZeroWidth(`Köln${ZERO_WIDTH_SPACE}${ZERO_WIDTH_NON_JOINER}`)).toBe(
      'Köln',
    );
  });

  it('removes the right-to-left mark that stripInvisible keeps', () => {
    expect(stripInvisibleAndZeroWidth(`a${RIGHT_TO_LEFT_MARK}b`)).toBe('ab');
  });
});
