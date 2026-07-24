import { describe, expect, it } from 'vitest';

import {
  LANGUAGES,
  LEGAL_AREAS,
  REGION_SUGGESTIONS,
  TARGET_GROUPS,
  parseMultiValue,
  serializeMultiValue,
} from './options';

describe('parseMultiValue', () => {
  it('returns an empty list for null or empty input', () => {
    expect(parseMultiValue(null)).toEqual([]);
    expect(parseMultiValue('')).toEqual([]);
    expect(parseMultiValue('   ')).toEqual([]);
  });

  it('splits a semicolon-separated string and trims each item', () => {
    expect(parseMultiValue('Mietrecht; Asylrecht ;Arbeitsrecht')).toEqual([
      'Mietrecht',
      'Asylrecht',
      'Arbeitsrecht',
    ]);
  });

  it('falls back to comma when there is no semicolon', () => {
    expect(parseMultiValue('Deutsch, Englisch, Arabisch')).toEqual([
      'Deutsch',
      'Englisch',
      'Arabisch',
    ]);
  });

  it('prefers the semicolon so a parenthesised comma list stays one item', () => {
    expect(parseMultiValue('Zivilrecht (Mietrecht, Kaufrecht); Strafrecht')).toEqual([
      'Zivilrecht (Mietrecht, Kaufrecht)',
      'Strafrecht',
    ]);
  });

  it('never splits inside brackets even when comma is the separator', () => {
    expect(parseMultiValue('Zivilrecht (Mietrecht, Kaufrecht)')).toEqual([
      'Zivilrecht (Mietrecht, Kaufrecht)',
    ]);
  });

  it('drops empty fragments and de-duplicates exact repeats', () => {
    expect(parseMultiValue('Mietrecht;; Mietrecht; Asylrecht')).toEqual(['Mietrecht', 'Asylrecht']);
  });
});

describe('serializeMultiValue', () => {
  it('joins with the canonical "; " separator', () => {
    expect(serializeMultiValue(['Mietrecht', 'Asylrecht'])).toBe('Mietrecht; Asylrecht');
  });

  it('trims, drops empties and de-duplicates before joining', () => {
    expect(serializeMultiValue([' Mietrecht ', '', 'Mietrecht', 'Asylrecht'])).toBe(
      'Mietrecht; Asylrecht',
    );
  });

  it('round-trips with parseMultiValue', () => {
    const serialized = 'Mietrecht; Asylrecht; Zivilrecht (Mietrecht, Kaufrecht)';
    expect(serializeMultiValue(parseMultiValue(serialized))).toBe(serialized);
  });
});

const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

describe('option catalogs', () => {
  it('offer "Bundesweit" as the first region suggestion', () => {
    expect(REGION_SUGGESTIONS[0]).toBe('Bundesweit');
  });

  it('includes every one of the 16 Bundesländer', () => {
    const offered: readonly string[] = REGION_SUGGESTIONS;
    expect(BUNDESLAENDER.every((land) => offered.includes(land))).toBe(true);
  });

  it('lists all 19 Regierungsbezirke, each prefixed and disambiguated from cities', () => {
    const bezirke = REGION_SUGGESTIONS.filter((entry) => entry.startsWith('Regierungsbezirk '));
    expect(bezirke).toHaveLength(19);
    expect(bezirke).toContain('Regierungsbezirk Köln');
    expect(bezirke).toContain('Regierungsbezirk Oberbayern');
  });

  it('includes the smallest and a mid-list Großstadt', () => {
    const offered: readonly string[] = REGION_SUGGESTIONS;
    expect(offered).toContain('Kaiserslautern');
    expect(offered).toContain('Duisburg');
  });

  it('lists a Stadtstaat exactly once despite being both Bundesland and Großstadt', () => {
    expect(REGION_SUGGESTIONS.filter((entry) => entry === 'Berlin')).toHaveLength(1);
  });

  it('lists LEGAL_AREAS in German alphabetical order', () => {
    const sorted = [...LEGAL_AREAS].sort((a, b) => a.localeCompare(b, 'de'));
    expect([...LEGAL_AREAS]).toEqual(sorted);
  });

  it('includes all six official UN languages', () => {
    const officialUnLanguages = [
      'Arabisch',
      'Chinesisch',
      'Englisch',
      'Französisch',
      'Russisch',
      'Spanisch',
    ];
    const offered: readonly string[] = LANGUAGES;
    expect(officialUnLanguages.every((lang) => offered.includes(lang))).toBe(true);
  });

  it('lists the world languages after the curated head in alphabetical order', () => {
    const offered: readonly string[] = LANGUAGES;
    const tail = offered.slice(offered.indexOf('Polnisch') + 1);
    const sorted = [...tail].sort((a, b) => a.localeCompare(b, 'de'));
    expect(tail).toEqual(sorted);
  });

  it.each([
    ['LEGAL_AREAS', LEGAL_AREAS],
    ['TARGET_GROUPS', TARGET_GROUPS],
    ['LANGUAGES', LANGUAGES],
    ['REGION_SUGGESTIONS', REGION_SUGGESTIONS],
  ])('%s contains no duplicate entries', (_name, list) => {
    expect(new Set(list).size).toBe(list.length);
  });
});
