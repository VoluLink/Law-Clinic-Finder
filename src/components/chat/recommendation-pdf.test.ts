import { describe, expect, it, vi } from 'vitest';

import { LANGS } from '@/lib/i18n/config';

import type { PdfFontFace } from './pdf-fonts';
import { pdfFontFamily, registerFontFaces, supportsPdfExport } from './recommendation-pdf';

function face(family: PdfFontFace['family'], style: PdfFontFace['style']): PdfFontFace {
  return { family, style, file: `${family}-${style}.ttf`, data: `${family}:${style}` };
}

const FACES = [
  face('Hanken Grotesk', 'normal'),
  face('Hanken Grotesk', 'bold'),
  face('Noto Sans', 'normal'),
  face('Noto Sans', 'bold'),
];

function recordingDoc(family: PdfFontFace['family']) {
  return {
    family,
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
  };
}

describe(pdfFontFamily, () => {
  it.each(['de', 'en', 'fr', 'ku', 'tr'] as const)('draws %s in Hanken Grotesk', (lang) => {
    expect(pdfFontFamily(lang)).toBe('Hanken Grotesk');
  });

  // Hanken Grotesk ships no basic Cyrillic block, which is the whole reason a
  // second family is vendored.
  it.each(['ru', 'uk'] as const)('draws %s in Noto Sans', (lang) => {
    expect(pdfFontFamily(lang)).toBe('Noto Sans');
  });
});

describe(supportsPdfExport, () => {
  it.each(['ar', 'fa'] as const)('offers no PDF for %s, because jsPDF cannot shape it', (lang) => {
    expect(supportsPdfExport(lang)).toBe(false);
  });

  it('offers a PDF in every other public language', () => {
    const offered = LANGS.map((entry) => entry.code).filter(supportsPdfExport);
    expect(offered).toEqual(['de', 'en', 'fr', 'ku', 'ru', 'uk', 'tr']);
  });
});

describe(registerFontFaces, () => {
  it('registers both styles of the family the sheet uses', () => {
    const doc = recordingDoc('Hanken Grotesk');
    registerFontFaces(doc, FACES);
    expect(doc.addFont.mock.calls).toEqual([
      ['Hanken Grotesk-normal.ttf', 'Hanken Grotesk', 'normal'],
      ['Hanken Grotesk-bold.ttf', 'Hanken Grotesk', 'bold'],
    ]);
  });

  /* Embedding both families would double the payload for every download, and a
   * sheet only ever draws in one of them. */
  it('embeds nothing from the family the sheet does not use', () => {
    const doc = recordingDoc('Noto Sans');
    registerFontFaces(doc, FACES);
    const embedded = doc.addFileToVFS.mock.calls.map(([file]) => file);
    expect(embedded).toEqual(['Noto Sans-normal.ttf', 'Noto Sans-bold.ttf']);
  });

  it('loads each payload into the virtual file system before registering it', () => {
    const doc = recordingDoc('Noto Sans');
    registerFontFaces(doc, FACES);
    expect(doc.addFileToVFS.mock.invocationCallOrder[0]).toBeLessThan(
      doc.addFont.mock.invocationCallOrder[0],
    );
  });
});
