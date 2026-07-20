import { describe, expect, it } from 'vitest';

import {
  chatSettingsUpdateSchema,
  DEFAULT_CHAT_SETTINGS,
  MAX_CHAT_MAX_TOKENS,
  parseChatSettings,
} from './settings';

describe(parseChatSettings, () => {
  it('maps settings rows to a typed object', () => {
    const settings = parseChatSettings([
      { key: 'chat_model', value: 'claude-haiku-4-5-20251001' },
      { key: 'chat_enabled', value: false },
      { key: 'chat_max_tokens', value: 2048 },
      { key: 'chat_system_prompt', value: 'Du bist ein Assistent.' },
    ]);
    expect(settings).toEqual({
      chat_model: 'claude-haiku-4-5-20251001',
      chat_enabled: false,
      chat_max_tokens: 2048,
      chat_system_prompt: 'Du bist ein Assistent.',
    });
  });

  it('falls back to defaults for missing keys', () => {
    const settings = parseChatSettings([]);
    expect(settings.chat_enabled).toBe(true);
    expect(settings.chat_model.length).toBeGreaterThan(0);
  });

  it('falls back to defaults for invalid values', () => {
    const settings = parseChatSettings([{ key: 'chat_max_tokens', value: 'not-a-number' }]);
    expect(typeof settings.chat_max_tokens).toBe('number');
  });

  it('falls back to the default when stored max_tokens exceeds the cost cap', () => {
    const settings = parseChatSettings([
      { key: 'chat_max_tokens', value: MAX_CHAT_MAX_TOKENS + 1 },
    ]);
    expect(settings.chat_max_tokens).toBe(DEFAULT_CHAT_SETTINGS.chat_max_tokens);
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
});
