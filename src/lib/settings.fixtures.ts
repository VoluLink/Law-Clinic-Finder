import type { ChatSettings } from './settings';

/**
 * A complete, valid ChatSettings for tests. The runtime has no default settings
 * object anymore (all values come from the DB), so tests build their own.
 */
export function makeChatSettings(overrides: Partial<ChatSettings> = {}): ChatSettings {
  return {
    chat_model: 'claude-haiku-4-5-20251001',
    chat_enabled: true,
    chat_max_tokens: 1024,
    chat_temperature: 0.3,
    chat_system_prompt: 'Test-Rolle',
    chat_skill: 'Test-Ablauf',
    chat_greeting: '',
    chat_max_recommendations: 8,
    ...overrides,
  };
}
