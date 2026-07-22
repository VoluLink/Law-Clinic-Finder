import { describe, expect, it } from 'vitest';

import { ASSISTANT_ROLE, buildSystemPrompt, CONSULTATION_SKILL } from './prompts';

describe(buildSystemPrompt, () => {
  it('wraps the role and the skill in their own tagged sections', () => {
    const prompt = buildSystemPrompt('WER ICH BIN', 'WAS ICH TUE');
    expect(prompt).toContain('<role>\nWER ICH BIN\n</role>');
    expect(prompt).toContain('<skill name="clinic-consultation">\nWAS ICH TUE\n</skill>');
  });

  it('puts the role before the skill so identity frames the procedure', () => {
    const prompt = buildSystemPrompt('ROLLE', 'ABLAUF');
    expect(prompt.indexOf('ROLLE')).toBeLessThan(prompt.indexOf('ABLAUF'));
  });

  it('composes admin-edited text verbatim, without dropping either part', () => {
    const prompt = buildSystemPrompt(ASSISTANT_ROLE, CONSULTATION_SKILL);
    expect(prompt).toContain(ASSISTANT_ROLE);
    expect(prompt).toContain(CONSULTATION_SKILL);
  });
});

describe('CONSULTATION_SKILL', () => {
  // The cards are the product; a reply that only lists clinics in prose is a
  // regression, so the procedure has to name the tool that renders them.
  it('names both tools the assistant is expected to drive', () => {
    expect(CONSULTATION_SKILL).toContain('search_clinics');
    expect(CONSULTATION_SKILL).toContain('recommend_clinics');
  });
});

describe('ASSISTANT_ROLE', () => {
  it('keeps the no-legal-advice constraint', () => {
    expect(ASSISTANT_ROLE).toContain('KEINE Rechtsberatung');
  });
});
