import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { getDictionary } from '@/lib/i18n/dictionary';

import { RecommendationExport } from './RecommendationExport';

const de = getDictionary('de');

const pdfMocks = vi.hoisted(() => ({
  save: vi.fn(),
  text: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
}));

/** Stands in for jsPDF's vector API. `splitTextToSize` and `getTextWidth` return
 *  deterministic metrics so the export can be exercised without a font engine. */
vi.mock('jspdf', () => ({
  jsPDF: class {
    save = pdfMocks.save;
    text = pdfMocks.text;
    addPage = pdfMocks.addPage;
    addImage = pdfMocks.addImage;
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setFillColor = vi.fn();
    setDrawColor = vi.fn();
    setLineWidth = vi.fn();
    rect = vi.fn();
    roundedRect = vi.fn();
    line = vi.fn();
    circle = vi.fn();
    splitTextToSize = (text: string) => [text];
    getTextWidth = (text: string) => text.length * 5;
  },
}));

const clinic: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Law Clinic Köln',
  region: 'Köln',
  areas: ['Mietrecht'],
  reason: 'Passt zum Chat.',
  website: 'https://example.org',
  email: 'kontakt@example.org',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RecommendationExport', () => {
  it('creates the PDF locally without making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RecommendationExport
        data={{
          details: ['Ich wohne in Köln.'],
          clinics: [clinic],
          generatedAt: '2026-07-26T12:00:00.000Z',
        }}
        dict={de}
        lang="de"
        rtl={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: de.downloadPdf }));
    await waitFor(() => expect(pdfMocks.save).toHaveBeenCalledOnce());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('draws real text rather than rasterising a DOM tree', async () => {
    render(
      <RecommendationExport
        data={{
          details: ['Ich wohne in Köln.'],
          clinics: [clinic],
          generatedAt: '2026-07-26T12:00:00.000Z',
        }}
        dict={de}
        lang="de"
        rtl={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: de.downloadPdf }));
    await waitFor(() => expect(pdfMocks.save).toHaveBeenCalledOnce());

    const drawn = pdfMocks.text.mock.calls.map(([value]) => String(value));
    expect(drawn).toContain('Law Clinic Köln');
    expect(pdfMocks.save).toHaveBeenCalledWith('law-clinic-finder-recommendation.pdf');
  });
});
