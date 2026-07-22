import { describe, expect, it } from 'vitest';

import {
  chatSettingsUpdateSchema,
  DEFAULT_CHAT_SETTINGS,
  MAX_CHAT_MAX_TOKENS,
  MAX_CHAT_RECOMMENDATIONS,
  parseChatSettings,
} from './settings';

describe(parseChatSettings, () => {
  it('maps settings rows to a typed object', () => {
    const stored = {
      chat_model: 'claude-haiku-4-5-20251001',
      chat_enabled: false,
      chat_max_tokens: 2048,
      chat_temperature: 0.7,
      chat_system_prompt: 'Du bist ein Assistent.',
      chat_skill: 'Frage zuerst nach dem Wohnort.',
      chat_greeting: 'Hallo!',
      chat_max_recommendations: 3,
    };
    const rows = Object.entries(stored).map(([key, value]) => ({ key, value }));
    expect(parseChatSettings(rows)).toEqual(stored);
  });

  it('falls back to defaults for missing keys', () => {
    const settings = parseChatSettings([]);
    expect(settings).toEqual(DEFAULT_CHAT_SETTINGS);
  });

  it('falls back to defaults for invalid values', () => {
    const settings = parseChatSettings([{ key: 'chat_max_tokens', value: 'not-a-number' }]);
    expect(settings.chat_max_tokens).toBe(DEFAULT_CHAT_SETTINGS.chat_max_tokens);
  });

  it('falls back to the default when stored max_tokens exceeds the cost cap', () => {
    const settings = parseChatSettings([
      { key: 'chat_max_tokens', value: MAX_CHAT_MAX_TOKENS + 1 },
    ]);
    expect(settings.chat_max_tokens).toBe(DEFAULT_CHAT_SETTINGS.chat_max_tokens);
  });

  it('falls back to the default when a stored temperature is out of range', () => {
    const settings = parseChatSettings([{ key: 'chat_temperature', value: 1.5 }]);
    expect(settings.chat_temperature).toBe(DEFAULT_CHAT_SETTINGS.chat_temperature);
  });

  it('keeps an empty greeting, which means no greeting bubble', () => {
    expect(parseChatSettings([{ key: 'chat_greeting', value: '' }]).chat_greeting).toBe('');
  });

  it('falls back when a stored recommendation cap exceeds the hard ceiling', () => {
    const settings = parseChatSettings([
      { key: 'chat_max_recommendations', value: MAX_CHAT_RECOMMENDATIONS + 1 },
    ]);
    expect(settings.chat_max_recommendations).toBe(MAX_CHAT_RECOMMENDATIONS);
  });
});

describe('chatSettingsUpdateSchema', () => {
  it('rejects max_tokens above the cost cap', () => {
    const result = chatSettingsUpdateSchema.safeParse({
      ...DEFAULT_CHAT_SETTINGS,
      chat_max_tokens: MAX_CHAT_MAX_TOKENS + 1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts max_tokens at the cost cap', () => {
    const result = chatSettingsUpdateSchema.safeParse({
      ...DEFAULT_CHAT_SETTINGS,
      chat_max_tokens: MAX_CHAT_MAX_TOKENS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a temperature above 1', () => {
    const result = chatSettingsUpdateSchema.safeParse({
      ...DEFAULT_CHAT_SETTINGS,
      chat_temperature: 1.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty skill, which would leave the assistant without a procedure', () => {
    const result = chatSettingsUpdateSchema.safeParse({
      ...DEFAULT_CHAT_SETTINGS,
      chat_skill: '',
    });
    expect(result.success).toBe(false);
  });
});
