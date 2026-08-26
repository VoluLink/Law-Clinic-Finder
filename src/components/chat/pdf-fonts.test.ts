import { jsPDF } from 'jspdf';
import { beforeEach, describe, expect, it } from 'vitest';

import { PDF_FONT_FACES, type PdfFontFace } from './pdf-fonts';

/**
 * Guards the vendored faces, not the layout: with jsPDF's built-in Helvetica the
 * sheet silently lost every glyph outside WinAnsi. A character the embedded font
 * does not cover still measures non-zero — jsPDF substitutes the `.notdef`
 * advance — so "has a glyph" is asserted against that fallback width rather than
 * against zero. No vendored face covers CJK, which makes it a stable sentinel.
 */
const SIZE = 10.5;
const MISSING_GLYPH = '漢';
const LATIN_FAMILY = 'Hanken Grotesk';
const CYRILLIC_FAMILY = 'Noto Sans';

const GERMAN = ['ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß'];
const TURKISH = ['ı', 'İ', 'ş', 'ğ'];
const KURDISH = ['ê', 'î', 'û', 'ç'];
const FRENCH = ['é', 'à', 'ô', 'œ'];
const PUNCTUATION = ['–', '…', '€'];
const LATIN = [...GERMAN, ...TURKISH, ...KURDISH, ...FRENCH, ...PUNCTUATION];
const CYRILLIC = ['А', 'б', 'в', 'ё', 'ж', 'ы', 'я', 'І', 'і', 'Ї', 'ї', 'Є', 'є', 'Ґ', 'ґ'];

let doc: jsPDF;

function widthOf(family: string, style: PdfFontFace['style'], text: string): number {
  doc.setFont(family, style);
  doc.setFontSize(SIZE);
  return doc.getTextWidth(text);
}

/** The probe characters that fall back to the missing-glyph box. */
function unglyphed(family: string, style: PdfFontFace['style'], probes: string[]): string[] {
  const fallback = widthOf(family, style, MISSING_GLYPH);
  return probes.filter((probe) => widthOf(family, style, probe) === fallback);
}

function unmeasured(family: string, style: PdfFontFace['style'], probes: string[]): string[] {
  return probes.filter((probe) => widthOf(family, style, probe) === 0);
}

beforeEach(() => {
  doc = new jsPDF({ format: 'a4', unit: 'pt' });
  for (const face of PDF_FONT_FACES) {
    doc.addFileToVFS(face.file, face.data);
    doc.addFont(face.file, face.family, face.style);
  }
});

describe('PDF_FONT_FACES', () => {
  it('registers a normal and a bold face for both families', () => {
    expect(doc.getFontList()).toMatchObject({
      [LATIN_FAMILY]: ['normal', 'bold'],
      [CYRILLIC_FAMILY]: ['normal', 'bold'],
    });
  });

  it.each(['normal', 'bold'] as const)(
    'measures every Latin probe character in the %s Hanken Grotesk face',
    (style) => {
      expect(unmeasured(LATIN_FAMILY, style, LATIN)).toEqual([]);
    },
  );

  it.each(['normal', 'bold'] as const)(
    'carries a real glyph for every Latin probe character in the %s Hanken Grotesk face',
    (style) => {
      expect(unglyphed(LATIN_FAMILY, style, LATIN)).toEqual([]);
    },
  );

  it.each(['normal', 'bold'] as const)(
    'measures every Cyrillic probe character in the %s Noto Sans face',
    (style) => {
      expect(unmeasured(CYRILLIC_FAMILY, style, CYRILLIC)).toEqual([]);
    },
  );

  it.each(['normal', 'bold'] as const)(
    'carries a real glyph for every Cyrillic probe character in the %s Noto Sans face',
    (style) => {
      expect(unglyphed(CYRILLIC_FAMILY, style, CYRILLIC)).toEqual([]);
    },
  );

  it('keeps Latin in Noto Sans, because a Russian sheet still lists German clinic names', () => {
    expect(unglyphed(CYRILLIC_FAMILY, 'normal', LATIN)).toEqual([]);
  });

  it('has no Cyrillic in Hanken Grotesk, which is why the second family exists', () => {
    expect(unglyphed(LATIN_FAMILY, 'normal', CYRILLIC)).toEqual(CYRILLIC);
  });

  it.each([LATIN_FAMILY, CYRILLIC_FAMILY])(
    'ships a genuinely heavier bold face for %s',
    (family) => {
      const sample = 'Law Clinic';

      expect(widthOf(family, 'bold', sample)).toBeGreaterThan(widthOf(family, 'normal', sample));
    },
  );
});
