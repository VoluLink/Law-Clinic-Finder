import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { getDictionary } from '@/lib/i18n/dictionary';

import { RecommendationExport } from './RecommendationExport';

const de = getDictionary('de');

const pdfMocks = vi.hoisted(() => ({
  html: vi.fn().mockResolvedValue(undefined),
  save: vi.fn(),
}));

vi.mock('jspdf', () => ({
  jsPDF: class {
    html = pdfMocks.html;
    save = pdfMocks.save;
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

  it('captures the printable document off-screen at A4 dimensions', async () => {
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
    await waitFor(() => expect(pdfMocks.html).toHaveBeenCalledOnce());

    const [root, options] = pdfMocks.html.mock.calls[0] as [HTMLElement, Record<string, unknown>];
    expect(root.style.left).toBe('-10000px');
    expect(root.style.zIndex).toBe('0');
    expect(options).toMatchObject({
      html2canvas: { backgroundColor: '#ffffff', logging: false, scale: 2 },
      width: 595,
      windowWidth: 595,
    });
  });
});
