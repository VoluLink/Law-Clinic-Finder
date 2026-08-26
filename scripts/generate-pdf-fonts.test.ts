import { describe, expect, it } from 'vitest';

import { renderFontModule, type EmbeddedFace } from './generate-pdf-fonts';

function face(overrides: Partial<EmbeddedFace> = {}): EmbeddedFace {
  return {
    family: 'Hanken Grotesk',
    style: 'normal',
    source: 'hanken-grotesk/HankenGrotesk-Regular.ttf',
    file: 'HankenGrotesk-Regular.ttf',
    data: 'AAEAAAALAIAAAwAw',
    ...overrides,
  };
}

describe('renderFontModule', () => {
  it('declares each distinct family once in the exported union', () => {
    const generated = renderFontModule([
      face(),
      face({ style: 'bold', file: 'HankenGrotesk-Bold.ttf' }),
      face({ family: 'Noto Sans', file: 'NotoSans-Regular.ttf' }),
    ]);

    expect(generated).toContain("export type PdfFontFamily = 'Hanken Grotesk' | 'Noto Sans';");
  });

  it('emits the base64 payload of every face', () => {
    const generated = renderFontModule([
      face({ data: 'Zmlyc3Q=' }),
      face({ style: 'bold', file: 'HankenGrotesk-Bold.ttf', data: 'c2Vjb25k' }),
    ]);

    expect(generated).toContain("data: 'Zmlyc3Q=',");
    expect(generated).toContain("data: 'c2Vjb25k',");
  });

  it('keeps the file name jsPDF registers the face under', () => {
    const generated = renderFontModule([face({ file: 'HankenGrotesk-Regular.ttf' })]);

    expect(generated).toContain("file: 'HankenGrotesk-Regular.ttf',");
  });

  it('renders byte-identical output for identical input, so re-running is a no-op', () => {
    const faces = [face(), face({ family: 'Noto Sans', file: 'NotoSans-Regular.ttf' })];

    expect(renderFontModule(faces)).toBe(renderFontModule(faces));
  });

  it('refuses to generate a module without a single face', () => {
    expect(() => renderFontModule([])).toThrow('No font faces to generate');
  });
});
