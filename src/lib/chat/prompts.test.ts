import { describe, expect, it } from 'vitest';

import {
  buildSystemPrompt,
  PROMPT_TOOLBOX,
  RECOMMEND_CLINICS_DESCRIPTION,
  SEARCH_CLINICS_DESCRIPTION,
  TOOL_NAMES,
} from './prompts';

describe(buildSystemPrompt, () => {
  it('wraps the role and the skill in their own tagged sections', () => {
    const prompt = buildSystemPrompt('WER ICH BIN', 'NUR DATENBANK', 'WAS ICH TUE');
    expect(prompt).toContain('<role>\nWER ICH BIN\n</role>');
    expect(prompt).toContain('<grounding>\nNUR DATENBANK\n</grounding>');
    expect(prompt).toContain('<skill name="clinic-consultation">\nWAS ICH TUE\n</skill>');
  });

  it('puts the non-editable grounding policy before the editable procedure', () => {
    const prompt = buildSystemPrompt('ROLLE', 'DATENQUELLE', 'ABLAUF');
    expect(prompt.indexOf('DATENQUELLE')).toBeLessThan(prompt.indexOf('ABLAUF'));
  });

  it('composes the given text verbatim, without dropping any part', () => {
    const role = 'Eine Rolle mit <Zeichen>, & Umlauten äöü.';
    const grounding = 'Nur aktuelle Datenbankwerte.';
    const skill = 'Ein Ablauf.\nMit Zeilenumbruch.';
    const prompt = buildSystemPrompt(role, grounding, skill);
    expect(prompt).toContain(role);
    expect(prompt).toContain(grounding);
    expect(prompt).toContain(skill);
  });
});

describe('PROMPT_TOOLBOX', () => {
  it('documents every tool the assistant can call, in flow order', () => {
    expect(PROMPT_TOOLBOX.map((tool) => tool.name)).toEqual([
      TOOL_NAMES.listDirectoryTerms,
      TOOL_NAMES.searchClinics,
      TOOL_NAMES.recommendClinics,
      TOOL_NAMES.reportNoMatch,
    ]);
  });

  it('gives each tool a non-empty explanation', () => {
    for (const tool of PROMPT_TOOLBOX) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('clinic tool descriptions', () => {
  it('tells the assistant how to request every result page', () => {
    expect(SEARCH_CLINICS_DESCRIPTION).toContain('next_offset');
  });

  it('tells the assistant to recommend clinics by exact id', () => {
    expect(RECOMMEND_CLINICS_DESCRIPTION).toContain('exact clinic id');
  });
});
