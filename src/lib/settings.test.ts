import { describe, expect, it } from 'vitest';

import { makeChatSettings } from './settings.fixtures';
import {
  chatSettingsUpdateSchema,
  MAX_CHAT_MAX_TOKENS,
  MAX_CHAT_RECOMMENDATIONS,
  parseChatSettings,
  readAssistantFormView,
  type SettingRow,
} from './settings';

function rowsFrom(settings: Record<string, unknown>): SettingRow[] {
  return Object.entries(settings).map(([key, value]) => ({ key, value }));
}

function rowsWith(key: string, value: unknown): SettingRow[] {
  return rowsFrom(makeChatSettings()).map((row) => (row.key === key ? { key, value } : row));
}

describe(parseChatSettings, () => {
  it('maps a complete, valid row set to a typed settings object', () => {
    const settings = makeChatSettings({ chat_greeting: 'Hallo!' });
    expect(parseChatSettings(rowsFrom(settings))).toEqual({ ok: true, settings });
  });

  it('reports the missing key when a setting has no row', () => {
    const rows = rowsFrom(makeChatSettings()).filter((row) => row.key !== 'chat_system_prompt');
    expect(parseChatSettings(rows)).toEqual({ ok: false, missing: ['chat_system_prompt'] });
  });

  it('treats an invalid value as unconfigured, not substituting a default', () => {
    expect(parseChatSettings(rowsWith('chat_max_tokens', 'not-a-number'))).toEqual({
      ok: false,
      missing: ['chat_max_tokens'],
    });
  });

  it('rejects a max_tokens above the cost cap', () => {
    expect(parseChatSettings(rowsWith('chat_max_tokens', MAX_CHAT_MAX_TOKENS + 1))).toEqual({
      ok: false,
      missing: ['chat_max_tokens'],
    });
  });

  it('accepts an empty greeting as configured', () => {
    const settings = makeChatSettings({ chat_greeting: '' });
    expect(parseChatSettings(rowsFrom(settings))).toEqual({ ok: true, settings });
  });

  it('rejects a recommendation cap above the hard ceiling', () => {
    expect(
      parseChatSettings(rowsWith('chat_max_recommendations', MAX_CHAT_RECOMMENDATIONS + 1)),
    ).toEqual({ ok: false, missing: ['chat_max_recommendations'] });
  });
});

describe(readAssistantFormView, () => {
  it('projects the stored values and the revert defaults', () => {
    const settings = makeChatSettings({ chat_system_prompt: 'Rolle X', chat_skill: 'Ablauf Y' });
    const view = readAssistantFormView([
      ...rowsFrom(settings),
      { key: 'chat_system_prompt_default', value: 'Standard-Rolle' },
      { key: 'chat_skill_default', value: 'Standard-Ablauf' },
    ]);
    expect(view.values).toEqual(settings);
    expect(view.defaults).toEqual({
      chat_system_prompt: 'Standard-Rolle',
      chat_skill: 'Standard-Ablauf',
    });
  });

  it('marks the prompt configured when Rolle and Ablauf are present', () => {
    expect(readAssistantFormView(rowsFrom(makeChatSettings())).promptConfigured).toBe(true);
  });

  it('flags the prompt as unconfigured and omits the missing field', () => {
    const rows = rowsFrom(makeChatSettings()).filter((row) => row.key !== 'chat_skill');
    const view = readAssistantFormView(rows);
    expect(view.promptConfigured).toBe(false);
    expect(view.values.chat_skill).toBeUndefined();
  });

  it('falls back to an empty default when no baseline row exists', () => {
    const view = readAssistantFormView(rowsFrom(makeChatSettings()));
    expect(view.defaults).toEqual({ chat_system_prompt: '', chat_skill: '' });
  });
});

describe('chatSettingsUpdateSchema', () => {
  it('rejects max_tokens above the cost cap', () => {
    const result = chatSettingsUpdateSchema.safeParse(
      makeChatSettings({ chat_max_tokens: MAX_CHAT_MAX_TOKENS + 1 }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts max_tokens at the cost cap', () => {
    const result = chatSettingsUpdateSchema.safeParse(
      makeChatSettings({ chat_max_tokens: MAX_CHAT_MAX_TOKENS }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a temperature above 1', () => {
    const result = chatSettingsUpdateSchema.safeParse(makeChatSettings({ chat_temperature: 1.1 }));
    expect(result.success).toBe(false);
  });

  it('rejects an empty skill, which would leave the assistant without a procedure', () => {
    const result = chatSettingsUpdateSchema.safeParse(makeChatSettings({ chat_skill: '' }));
    expect(result.success).toBe(false);
  });
});
