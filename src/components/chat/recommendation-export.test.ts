import { describe, expect, it } from 'vitest';

import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { getDictionary } from '@/lib/i18n/dictionary';

import { buildRecommendationText, collectRecommendationExport } from './recommendation-export';

const de = getDictionary('de');

const firstClinic: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht', 'Nebenkosten'],
  reason: 'Berät genau zu deinem Thema.',
  website: 'https://milcc.de/',
  email: 'kontakt@milcc.de',
};

const finalClinic: ClinicRecommendation = {
  ...firstClinic,
  id: 'ff000000-0000-0000-0000-000000000002',
  name: 'Final Law Clinic',
  reason: 'Passt zu den späteren Angaben.',
};

const generatedAt = '2026-07-26T12:00:00.000Z';

describe('collectRecommendationExport', () => {
  it('keeps every detail supplied by the user', () => {
    const exportData = collectRecommendationExport([
      { role: 'user', content: 'Ich brauche Hilfe mit meiner Miete.' },
      { role: 'assistant', content: 'In welcher Stadt wohnst du?' },
      { role: 'user', content: 'Ich wohne in Köln.' },
    ]);

    expect(exportData.details).toEqual([
      'Ich brauche Hilfe mit meiner Miete.',
      'Ich wohne in Köln.',
    ]);
  });

  it('exports only the latest recommendation set', () => {
    const exportData = collectRecommendationExport([
      { role: 'assistant', content: '', recommendations: [firstClinic] },
      { role: 'user', content: 'Ich kann auch bundesweit beraten werden.' },
      { role: 'assistant', content: '', recommendations: [finalClinic] },
    ]);

    expect(exportData.clinics).toEqual([{ ...finalClinic, rank: 1 }]);
  });
});

describe('buildRecommendationText', () => {
  it('includes the reason and direct contact details for each recommendation', () => {
    const text = buildRecommendationText(
      {
        details: ['Ich brauche Hilfe mit meiner Miete.', 'Ich wohne in Köln.'],
        clinics: [firstClinic],
        generatedAt,
      },
      de,
      'de',
    );

    expect(text).toContain(
      'Angaben aus dem Chat:\n- Ich brauche Hilfe mit meiner Miete.\n- Ich wohne in Köln.',
    );
  });

  it('includes the same dated recommendation details as the PDF', () => {
    const text = buildRecommendationText(
      { details: ['Ich wohne in Köln.'], clinics: [firstClinic], generatedAt },
      de,
      'de',
    );

    expect(text).toContain(
      'Erstellt am 26. Juli 2026\n\nAngaben aus dem Chat:\n- Ich wohne in Köln.\n\n1. Mietrecht Law Clinic Cologne',
    );
  });

  it('leaves out absent contact details instead of rendering empty labels', () => {
    const text = buildRecommendationText(
      {
        details: ['Ich brauche Hilfe.'],
        clinics: [{ ...firstClinic, website: null, email: null }],
        generatedAt,
      },
      de,
      'de',
    );

    expect(text).not.toMatch(/Website:|E-Mail:/);
  });
});
