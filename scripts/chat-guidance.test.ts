import { describe, expect, it } from 'vitest';

import {
  GUIDANCE_MARKER,
  hasSuggestionGuidance,
  SUGGESTION_GUIDANCE,
  withSuggestionGuidance,
} from './chat-guidance';
import { guidancePlan, parseGuidanceArguments } from './update-chat-guidance';

const EXISTING_SKILL = '1. Frage nach dem Anliegen.\n2. Suche passende Clinics.';

describe(withSuggestionGuidance, () => {
  it('keeps the admin-authored Ablauf above the appended block', () => {
    expect(withSuggestionGuidance(EXISTING_SKILL)).toContain(EXISTING_SKILL);
  });

  it('appends the guidance block', () => {
    expect(withSuggestionGuidance(EXISTING_SKILL)).toContain(SUGGESTION_GUIDANCE);
  });

  it('is idempotent — re-running adds exactly one block', () => {
    const once = withSuggestionGuidance(EXISTING_SKILL);
    const twice = withSuggestionGuidance(once);
    expect(twice.split(GUIDANCE_MARKER)).toHaveLength(2);
  });

  it('produces identical text on a second run', () => {
    const once = withSuggestionGuidance(EXISTING_SKILL);
    expect(withSuggestionGuidance(once)).toBe(once);
  });

  it('replaces an earlier revision rather than stacking one', () => {
    const stale = `${EXISTING_SKILL}\n\n${GUIDANCE_MARKER}\n\n- veraltete Fassung`;
    const updated = withSuggestionGuidance(stale);
    expect(updated).not.toContain('veraltete Fassung');
    expect(updated.split(GUIDANCE_MARKER)).toHaveLength(2);
  });

  it('states that recommendations are only suggestions', () => {
    expect(withSuggestionGuidance(EXISTING_SKILL)).toContain('Vorschläge');
  });

  it('tells the model the cards render below its message', () => {
    expect(withSuggestionGuidance(EXISTING_SKILL)).toContain('Karten unterhalb deiner Nachricht');
  });

  it('points to the explanation below the chat window', () => {
    expect(withSuggestionGuidance(EXISTING_SKILL)).toContain('unterhalb des Chatfensters');
  });
});

describe(hasSuggestionGuidance, () => {
  it('is false before the block is applied', () => {
    expect(hasSuggestionGuidance(EXISTING_SKILL)).toBe(false);
  });

  it('is true afterwards', () => {
    expect(hasSuggestionGuidance(withSuggestionGuidance(EXISTING_SKILL))).toBe(true);
  });
});

describe(parseGuidanceArguments, () => {
  it('previews by default so a bare run cannot write', () => {
    expect(parseGuidanceArguments([])).toEqual({ apply: false, confirmedTarget: null });
  });

  it('reads the confirmed target alongside --apply', () => {
    expect(parseGuidanceArguments(['--apply', '--confirm-target', 'law-clinic-finder'])).toEqual({
      apply: true,
      confirmedTarget: 'law-clinic-finder',
    });
  });
});

describe(guidancePlan, () => {
  const skill = '1. Frage nach dem Anliegen.';

  it('reports work to do when the baseline is untouched', () => {
    const plan = guidancePlan({ chat_skill: skill, chat_skill_default: skill });
    expect(plan.alreadyApplied).toBe(false);
  });

  it('updates the revert baseline too, so reverting keeps the guidance', () => {
    const plan = guidancePlan({ chat_skill: skill, chat_skill_default: skill });
    expect(hasSuggestionGuidance(plan.baseline)).toBe(true);
  });

  it('reports nothing to do once both carry the block', () => {
    const applied = withSuggestionGuidance(skill);
    const plan = guidancePlan({ chat_skill: applied, chat_skill_default: applied });
    expect(plan.alreadyApplied).toBe(true);
  });

  it('leaves an absent baseline absent rather than inventing one', () => {
    const plan = guidancePlan({ chat_skill: skill });
    expect(plan.baseline).toBe('');
  });

  it('rejects a settings document with no Ablauf', () => {
    expect(() => guidancePlan({ chat_skill: '' })).toThrow();
  });
});
