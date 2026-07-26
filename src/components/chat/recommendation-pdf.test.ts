import { describe, expect, it } from 'vitest';

import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { de } from '@/lib/i18n/locales/de';

import { buildRecommendationText } from './recommendation-export';
import { buildRecommendationPdfMarkup } from './recommendation-pdf';

const clinic: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Law Clinic Köln',
  region: 'Köln',
  areas: ['Mietrecht'],
  reason: 'Passt zu den Angaben aus dem Chat.',
  website: 'https://example.org',
  email: 'kontakt@example.org',
};

const data = {
  details: ['Die Kündigung kam gestern.', 'Ich wohne in Köln.'],
  clinics: [clinic],
  generatedAt: '2026-07-26T12:00:00.000Z',
};

describe('buildRecommendationPdfMarkup', () => {
  it('renders every supplied chat detail as a separate list item', () => {
    const document = new DOMParser().parseFromString(
      buildRecommendationPdfMarkup(data, de, 'de'),
      'text/html',
    );

    expect(
      Array.from(document.querySelectorAll('[data-export-detail]'), (item) => item.textContent),
    ).toEqual(data.details);
  });

  it('contains the same dated core information as the copied text', () => {
    const markup = buildRecommendationPdfMarkup(data, de, 'de');
    const text = buildRecommendationText(data, de, 'de');
    const coreValues = ['26. Juli 2026', clinic.name, clinic.reason, clinic.email!];

    expect(coreValues.every((value) => markup.includes(value) && text.includes(value))).toBe(true);
  });
});
