import { describe, expect, it } from 'vitest';

import { getDictionary } from '@/lib/i18n/dictionary';

import { PAGE, planRecommendationPdf, type TextMeasurer } from './pdf-layout';
import type { RecommendationExport } from './recommendation-export';

/** Fixed metrics: a deterministic stand-in for jsPDF, so the layout is asserted
 *  rather than the font engine. */
const CHAR_WIDTH = 5;

const measure: TextMeasurer = {
  widthOf: (text) => text.length * CHAR_WIDTH,
  wrap: (text, width) => {
    const perLine = Math.max(1, Math.floor(width / CHAR_WIDTH));
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > perLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  },
};

function clinic(overrides: Partial<RecommendationExport['clinics'][number]> = {}) {
  return {
    id: 'c1',
    rank: 1,
    name: 'Mietrecht Law Clinic Cologne',
    region: 'Stadtgebiet Köln',
    areas: ['Mietrecht'],
    reason: 'Spezialisiert ausschließlich auf Mietrecht.',
    website: 'https://milcc.de/',
    email: 'kontakt@milcc.de',
    ...overrides,
  };
}

function exportData(count: number, overrides = {}): RecommendationExport {
  return {
    details: ['Mein Vermieter will mir wegen Eigenbedarf kündigen.'],
    clinics: Array.from({ length: count }, (_, index) =>
      clinic({ id: `c${index}`, rank: index + 1, ...overrides }),
    ),
    generatedAt: '2026-08-22T10:00:00.000Z',
  };
}

function plan(data: RecommendationExport) {
  return planRecommendationPdf(data, getDictionary('de'), measure, '22. August 2026');
}

describe(planRecommendationPdf, () => {
  it('fits a short recommendation on one page', () => {
    expect(plan(exportData(1)).pages).toHaveLength(1);
  });

  it('fits the reference sheet of three clinics on one page', () => {
    expect(plan(exportData(3)).pages).toHaveLength(1);
  });

  it('starts a second page once the first is full', () => {
    expect(plan(exportData(12)).pages.length).toBeGreaterThan(1);
  });

  it('never splits a card across a page boundary', () => {
    const bottom = PAGE.height - PAGE.margin;
    for (const page of plan(exportData(12)).pages) {
      for (const placed of page.blocks) {
        expect(placed.y + placed.block.height).toBeLessThanOrEqual(bottom);
      }
    }
  });

  it('places every card inside the page margins', () => {
    for (const page of plan(exportData(12)).pages) {
      for (const placed of page.blocks) {
        expect(placed.y).toBeGreaterThanOrEqual(PAGE.margin);
      }
    }
  });

  it('keeps a card taller than a page on its own page instead of looping', () => {
    const huge = exportData(1, { reason: 'Sehr lange Begründung. '.repeat(400) });
    const pages = plan(huge).pages;
    expect(pages.length).toBeLessThanOrEqual(3);
  });

  it('wraps the reason within the card width', () => {
    const data = exportData(1, { reason: 'Wort '.repeat(120).trim() });
    const block = plan(data).pages[0].blocks.find((placed) => placed.block.kind === 'clinic');
    const lines = block?.block.kind === 'clinic' ? block.block.reasonLines : [];
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length * CHAR_WIDTH).toBeLessThanOrEqual(PAGE.width);
    }
  });

  it('keeps German umlauts and ß intact in the text runs', () => {
    const data = exportData(1, {
      reason: 'Kündigung wegen Eigenbedarf, einbehaltene Kaution größer.',
    });
    const block = plan(data).pages[0].blocks.find((placed) => placed.block.kind === 'clinic');
    const joined = block?.block.kind === 'clinic' ? block.block.reasonLines.join(' ') : '';
    expect(joined).toContain('Kündigung');
    expect(joined).toContain('größer');
  });

  it('omits the contact row when a clinic has neither website nor e-mail', () => {
    const data = exportData(1, { website: null, email: null });
    const block = plan(data).pages[0].blocks.find((placed) => placed.block.kind === 'clinic');
    expect(block?.block.kind === 'clinic' ? block.block.contact : null).toEqual([]);
  });

  it('omits the chip row when a clinic lists no legal areas', () => {
    const data = exportData(1, { areas: [] });
    const block = plan(data).pages[0].blocks.find((placed) => placed.block.kind === 'clinic');
    expect(block?.block.kind === 'clinic' ? block.block.chipRows : null).toEqual([]);
  });

  it('wraps many legal areas onto more than one chip row', () => {
    const data = exportData(1, {
      areas: [
        'Allgemeines Zivilrecht',
        'Aufenthalts- und Asylrecht',
        'Arbeits- und Sozialrecht',
        'Familien- und Erbrecht',
        'Miet- und Wohnungsrecht',
        'Verbraucherschutzrecht',
      ],
    });
    const block = plan(data).pages[0].blocks.find((placed) => placed.block.kind === 'clinic');
    const rows = block?.block.kind === 'clinic' ? block.block.chipRows : [];
    expect(rows.length).toBeGreaterThan(1);
  });

  it('omits the concern card when the visitor wrote nothing', () => {
    const data = { ...exportData(1), details: [] };
    const kinds = plan(data).pages[0].blocks.map((placed) => placed.block.kind);
    expect(kinds).not.toContain('concern');
  });

  it('leads with the concern card when there is one', () => {
    expect(plan(exportData(1)).pages[0].blocks[0].block.kind).toBe('concern');
  });
});
